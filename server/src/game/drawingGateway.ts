/**
 * Drawing ingest (D03-016, `server-state-writer-map.md` section 2.3,
 * `realtime-contract.md` section 11).
 *
 * The single writer of `round.strokes[]`. Strokes are volatile: they live in a
 * rolling 30 s window (`STROKE_HISTORY_MS`) and are never persisted
 * (`data-model.md` section 8).
 *
 * Ordering: `strokeSeq` opens strokes in order, `pointIndex` must increase
 * monotonically inside the open stroke. A late batch - one whose `pointIndex`
 * is not greater than the last applied one, or whose `strokeId` is not the
 * open stroke - is dropped silently, because a stroke is media, not game
 * state. There is deliberately NO server-side geometry validation (D03-016):
 * coordinates are validated as finite numbers by the Zod schema and by nothing
 * else.
 *
 * Audience: the `draw:*` broadcasts and `canvas:cleared` go to the room
 * *excluding the drawer's own sockets* (`realtime-contract.md` section 7). The
 * drawer already holds the stroke locally, and echoing it back would replay
 * their own points into their canvas.
 */

import { MAX_POINTS_PER_STROKE, STROKE_HISTORY_MS } from '../../../shared/contract/constants.js';
import { appendStrokeOp, clearStrokes, readStrokeOps } from '../redis/roomState.js';
import type { Stroke, Point } from '../../../shared/contract/types.js';
import type { StrokeOp } from './types.js';
import type { Services } from './services.js';

interface StrokeCursor {
  strokeSeq: number;
  strokeId: string | null;
  pointIndex: number;
  color: string;
  brushSize: number;
  startedAt: number;
  /** The drawer who owns the open stroke; `draw:*` excludes their sockets. */
  playerId: string | null;
}

export class DrawingGateway {
  /** Non-authoritative media cursors, rebuilt from nothing after a restart. */
  private readonly cursors = new Map<string, StrokeCursor>();

  constructor(private readonly services: Services) {}

  private cursor(roomId: string): StrokeCursor {
    const existing = this.cursors.get(roomId);
    if (existing !== undefined) return existing;
    const fresh: StrokeCursor = {
      strokeSeq: -1,
      strokeId: null,
      pointIndex: -1,
      color: '',
      brushSize: 1,
      startedAt: 0,
      playerId: null,
    };
    this.cursors.set(roomId, fresh);
    return fresh;
  }

  /** Called by `RoundService` when a round opens or a canvas is cleared. */
  reset(roomId: string): void {
    this.cursors.delete(roomId);
  }

  async start(
    roomId: string,
    payload: {
      strokeId: string;
      strokeSeq: number;
      color: string;
      brushSize: number;
      points: Point[];
    },
    version: number,
    drawerPlayerId: string,
  ): Promise<boolean> {
    const cursor = this.cursor(roomId);
    if (payload.strokeSeq <= cursor.strokeSeq) return false;
    const now = this.services.clock.now();
    cursor.strokeSeq = payload.strokeSeq;
    cursor.strokeId = payload.strokeId;
    cursor.pointIndex = payload.points.length - 1;
    cursor.color = payload.color;
    cursor.brushSize = payload.brushSize;
    cursor.startedAt = now;
    cursor.playerId = drawerPlayerId;
    const op: StrokeOp = {
      op: 'start',
      t: now,
      strokeId: payload.strokeId,
      strokeSeq: payload.strokeSeq,
      color: payload.color,
      brushSize: payload.brushSize,
      points: payload.points.slice(0, MAX_POINTS_PER_STROKE),
    };
    await appendStrokeOp(this.services.redis, roomId, op);
    await this.services.bus.toRoomExceptPlayer(roomId, drawerPlayerId, 'draw:start', {
      type: 'draw:start',
      strokeId: payload.strokeId,
      strokeSeq: payload.strokeSeq,
      color: payload.color,
      brushSize: payload.brushSize,
      points: payload.points,
      version,
    });
    return true;
  }

  async move(
    roomId: string,
    payload: { strokeId: string; pointIndex: number; points: Point[] },
    version: number,
  ): Promise<boolean> {
    const cursor = this.cursor(roomId);
    if (cursor.strokeId === null || cursor.strokeId !== payload.strokeId) {
      return false;
    }
    if (payload.pointIndex <= cursor.pointIndex) return false;
    const drawerPlayerId = cursor.playerId;
    if (drawerPlayerId === null) return false;
    cursor.pointIndex = payload.pointIndex + payload.points.length - 1;
    const op: StrokeOp = {
      op: 'move',
      t: this.services.clock.now(),
      strokeId: payload.strokeId,
      pointIndex: payload.pointIndex,
      points: payload.points,
    };
    await appendStrokeOp(this.services.redis, roomId, op);
    await this.services.bus.toRoomExceptPlayer(roomId, drawerPlayerId, 'draw:move', {
      type: 'draw:move',
      strokeId: payload.strokeId,
      pointIndex: payload.pointIndex,
      points: payload.points,
      version,
    });
    return true;
  }

  async end(roomId: string, strokeId: string, version: number): Promise<boolean> {
    const cursor = this.cursor(roomId);
    if (cursor.strokeId === null || cursor.strokeId !== strokeId) return false;
    const drawerPlayerId = cursor.playerId;
    cursor.strokeId = null;
    const op: StrokeOp = { op: 'end', t: this.services.clock.now(), strokeId };
    await appendStrokeOp(this.services.redis, roomId, op);
    if (drawerPlayerId !== null) {
      await this.services.bus.toRoomExceptPlayer(
        roomId,
        drawerPlayerId,
        'draw:end',
        { type: 'draw:end', strokeId, version },
      );
    }
    return true;
  }

  async clear(
    roomId: string,
    version: number,
    roundNumber: number,
    drawerPlayerId: string,
  ): Promise<void> {
    this.reset(roomId);
    await clearStrokes(this.services.redis, roomId);
    await this.services.bus.toRoomExceptPlayer(
      roomId,
      drawerPlayerId,
      'canvas:cleared',
      { type: 'canvas:cleared', roundNumber, version },
    );
  }

  /** Reconstruct the strokes peers would replay (`reconnect-protocol.md` §3). */
  async strokesForSnapshot(roomId: string): Promise<Stroke[]> {
    const ops = await readStrokeOps(this.services.redis, roomId);
    const since = this.services.clock.now() - STROKE_HISTORY_MS;
    return replayStrokes(ops, since);
  }
}

/** Fold stroke ops into `Stroke`s, dropping anything older than `since`. */
export function replayStrokes(
  ops: readonly StrokeOp[],
  since: number,
): Stroke[] {
  const byId = new Map<string, Stroke>();
  const order: string[] = [];
  for (const op of ops) {
    if (op.t < since) continue;
    if (op.op === 'start') {
      if (!byId.has(op.strokeId)) order.push(op.strokeId);
      byId.set(op.strokeId, {
        strokeId: op.strokeId,
        color: op.color,
        brushSize: op.brushSize,
        points: op.points.slice(0, MAX_POINTS_PER_STROKE),
      });
    } else if (op.op === 'move') {
      const stroke = byId.get(op.strokeId);
      if (stroke === undefined) continue;
      for (const point of op.points) {
        if (stroke.points.length >= MAX_POINTS_PER_STROKE) break;
        stroke.points.push(point);
      }
    }
  }
  return order
    .map((id) => byId.get(id))
    .filter((stroke): stroke is Stroke => stroke !== undefined);
}
