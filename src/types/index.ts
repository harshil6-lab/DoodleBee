/**
 * Public shared domain types (client/server contract surface).
 *
 * RULES (Stage 02 ADR v2.0 - docs/agent-runs/02-client-architecture/04-architecture-decision.md):
 * - This module is PUBLIC. It must NEVER contain the secret word or any
 *   other drawer-private field. Drawer-private contracts live in
 *   `./drawer-private` and must never be re-exported from here.
 * - Runtime validation belongs in `src/validation`, not in this file.
 * - Server-side types are aligned separately (Stage 3); see ADR AD-008.
 */

// ---------------------------------------------------------------- Player ----

export interface Player {
  playerId: string;
  nickname: string;
  isHost: boolean;
  score: number;
  isConnected: boolean;
}

// ------------------------------------------------------------------ Room ----

export interface RoomConfig {
  roomName: string;
  maxPlayers: number;
  rounds: number;
  /** Round length in seconds. */
  roundDuration: number;
  hints: number;
}

/**
 * NOTE: `projectInfo.md` section 6 lists a room `status` property, but no
 * approved document defines its allowed values. Per the project golden rule
 * ("DO NOT GUESS"), it is intentionally not modelled here; Stage 3 (game
 * state machine) owns that decision.
 */
export interface Room {
  roomId: string;
  roomCode: string;
  config: RoomConfig;
  players: Player[];
  /** playerId of the current host. */
  host: string;
}

// ------------------------------------------------------------------ Game ----

export type GamePhase =
  | 'WAITING'
  | 'STARTING'
  | 'ROUND_ACTIVE'
  | 'ROUND_FINISHED'
  | 'NEXT_ROUND'
  | 'GAME_FINISHED';

export interface RoundTimer {
  /** Unix timestamp in milliseconds, or null when no round is running. */
  roundEndTime: number | null;
}

// --------------------------------------------------------------- Drawing ----

export interface Point {
  /** Normalized 0-1 relative to the canvas bounds. */
  x: number;
  /** Normalized 0-1 relative to the canvas bounds. */
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  brushSize: number;
  erased: boolean;
}

// ---------------------------------------------------------- Event names -----

export enum ClientToServerEvent {
  JoinRoom = 'join:room',
  LeaveRoom = 'leave:room',
  SubmitGuess = 'guess:submit',
  SendChat = 'chat:message',
  UseHint = 'hint:request',
  StartGame = 'game:start',
  DrawStart = 'draw:start',
  DrawMove = 'draw:move',
  DrawEnd = 'draw:end',
  ClearCanvas = 'canvas:clear',
  /** Stage 03 E-05: reconnect request (ADR AD-009). */
  RequestStateSnapshot = 'request:state:snapshot',
}

export enum ServerToClientEvent {
  RoomJoined = 'room:joined',
  PlayerJoined = 'player:joined',
  PlayerLeft = 'player:left',
  HostTransferred = 'host:transferred',
  GameStarted = 'game:started',
  RoundStarted = 'round:started',
  DrawerSelected = 'drawer:selected',
  DrawStart = 'draw:start',
  DrawMove = 'draw:move',
  DrawEnd = 'draw:end',
  GuessSubmitted = 'guess:submitted',
  GuessCorrect = 'guess:correct',
  HintRevealed = 'hint:revealed',
  RoundEnded = 'round:ended',
  ScoreUpdated = 'score:updated',
  GameFinished = 'game:finished',
  ConnectionLost = 'connection:lost',
  /** Stage 03 E-01: the writer of `room.config` (ADR section 7). */
  RoomConfigUpdated = 'room:config:updated',
  /** Stage 03 E-02: the single writer of `game.chats` (ADR section 7). */
  ChatMessage = 'chat:message',
  /** Stage 03 E-03: the writers of `Player.isConnected`. */
  PlayerDisconnected = 'player:disconnected',
  PlayerReconnected = 'player:reconnected',
  /** Stage 03 E-04: lets peers learn of a canvas clear (ADR section 13.4). */
  CanvasCleared = 'canvas:cleared',
  /** Stage 03 E-05: reconnect response (ADR AD-009). */
  StateSnapshot = 'response:state:snapshot',
}

// ------------------------------------------------------- Public payloads ----
// These payloads are broadcast to / readable by every room member.
// None of them may carry the secret word (ADR section 9.3).

export interface JoinRoomPayload {
  roomCode: string;
  nickname: string;
}

/** Guesser-facing form of `drawer:selected` - deliberately has no secretWord. */
export interface PublicDrawerSelectedPayload {
  type: ServerToClientEvent.DrawerSelected;
  playerId: string;
  maskedWord: string;
}

export interface RoundStartedPayload {
  type: ServerToClientEvent.RoundStarted;
  phase: 'ROUND_ACTIVE';
  timer: RoundTimer;
  maskedWord: string;
  hintsRemaining: number;
}

export interface GuessCorrectPayload {
  type: ServerToClientEvent.GuessCorrect;
  playerId: string;
  rank: number;
  points: number;
}

export interface RoundEndedPayload {
  type: ServerToClientEvent.RoundEnded;
  winnerPlayerId: string | null;
  rankings: { playerId: string; rank: number; points: number }[];
}

export interface ScoreUpdatedPayload {
  type: ServerToClientEvent.ScoreUpdated;
  scores: Record<string, number>;
}

export interface GameFinishedPayload {
  type: ServerToClientEvent.GameFinished;
  finalScores: Record<string, number>;
  rankings: { playerId: string; rank: number; score: number }[];
  winnerId: string;
}

// ------------------------------- Stage 03 additive contract (E-01 ... E-05) -
// Additions required by `realtime-contract.md` section 8, mirroring
// `shared/contract/server-payloads.ts` and `reconnect-protocol.md` section 3.
// Nothing above is renamed and no locked payload field changes meaning.

/** `state-machine.md` section 1.1. **PROPOSED** value set (D03-026 / OC-4). */
export type RoomStatus = 'WAITING' | 'IN_GAME' | 'CLOSED';

export type Role = 'DRAWER' | 'GUESSER';

/** The exactly-three round-end triggers (D03-012). */
export type RoundEndReason =
  | 'TIMER_EXPIRED'
  | 'ALL_GUESSERS_CORRECT'
  | 'DRAWER_ABANDONED'
  | 'SERVER_TERMINATED';

/** `realtime-contract.md` section 9.3. */
export type ChatMessageType = 'NORMAL' | 'GUESS' | 'SYSTEM' | 'CORRECT_GUESS';

/** E-01 - the writer of `room.config`. Carries no secret. */
export interface RoomConfigUpdatedPayload {
  type: ServerToClientEvent.RoomConfigUpdated;
  config: RoomConfig;
  version: number;
}

/** E-02 - one event with a discriminator for the whole chat ring. */
export interface ChatMessagePayload {
  type: ServerToClientEvent.ChatMessage;
  id: string;
  messageType: ChatMessageType;
  /** null for SYSTEM messages. */
  senderPlayerId: string | null;
  senderNickname: string | null;
  text: string;
  /** Server clock, epoch ms. */
  createdAt: number;
  version: number;
}

/** E-02 - a wrong/close guess, mirrored into `game.chats`. No secret word. */
export interface GuessSubmittedPayload {
  type: ServerToClientEvent.GuessSubmitted;
  playerId: string;
  nickname: string;
  /** The guesser's own text, which by definition is not the secret word. */
  text: string;
  result: 'WRONG' | 'CLOSE';
  version: number;
}

/** A `game.chats` / snapshot `chat[]` entry. */
export type ChatEntry = ChatMessagePayload | GuessSubmittedPayload;

/** E-03 - the writer of `Player.isConnected` (false). */
export interface PlayerDisconnectedPayload {
  type: ServerToClientEvent.PlayerDisconnected;
  playerId: string;
  /** Server clock, epoch ms, at which the grace period expires. */
  graceDeadline: number;
  version: number;
}

/** E-03 - the writer of `Player.isConnected` (true). */
export interface PlayerReconnectedPayload {
  type: ServerToClientEvent.PlayerReconnected;
  playerId: string;
  version: number;
}

/** E-04 - lets peers learn that the canvas was cleared. */
export interface CanvasClearedPayload {
  type: ServerToClientEvent.CanvasCleared;
  roundNumber: number;
  version: number;
}

/**
 * A stroke as replayed inside a snapshot (`shared/contract` `StrokeSchema`).
 * Distinct from the local drawing `Stroke` above: the wire shape uses
 * `strokeId` and carries no `erased` flag. A separate name avoids changing
 * the locked Stage 02 `Stroke`.
 */
export interface SnapshotStroke {
  strokeId: string;
  color: string;
  brushSize: number;
  points: Point[];
}

/** A roster entry inside a snapshot. No secret, no drawer-private field. */
export interface PublicPlayer {
  playerId: string;
  nickname: string;
  score: number;
  isConnected: boolean;
  isHost: boolean;
  seatOrder: number;
}

/** The round timer as the client renders it. Never a countdown. */
export interface RoundTimerState {
  roundEndTime: number | null;
  paused: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}

export interface SnapshotRoom {
  roomId: string;
  roomCode: string;
  roomName: string;
  /** PROPOSED value set (D03-026 / OC-4). */
  status: RoomStatus;
  hostPlayerId: string;
  config: RoomConfig;
}

export interface SnapshotYou {
  playerId: string;
  nickname: string;
  role: Role;
  score: number;
  hasGuessedCorrectly: boolean;
}

export interface SnapshotGame {
  gameId: string | null;
  phase: GamePhase;
  roundNumber: number;
  roundsPlanned: number;
}

export interface CorrectGuesserEntry {
  playerId: string;
  nickname: string;
  rank: number;
  points: number;
}

export interface SnapshotRound {
  roundId: string | null;
  drawerPlayerId: string | null;
  maskedWord: string;
  revealedPositions: number[];
  hintsRemaining: number;
  timer: RoundTimerState;
  endReason?: RoundEndReason;
  /** `ROUND_FINISHED` only: the round is over, so the word is safe. */
  word?: string;
  /**
   * PRESENT ONLY when `you.role === 'DRAWER'` and the phase is `ROUND_ACTIVE`.
   * The server deletes the property (never nulls it) for a guesser; the
   * drawer-only variant in `./drawer-private` makes it required.
   */
  secretWord?: string;
  /** `STARTING` only. */
  startingDeadline?: number;
  /** `ROUND_FINISHED` only. */
  resultsDeadline?: number;
  /** `NEXT_ROUND` only. */
  nextDrawerPlayerId?: string;
}

/**
 * E-05 - `response:state:snapshot` (`reconnect-protocol.md` section 3).
 *
 * This is the public projection: a guesser never receives
 * `round.secretWord`. Only the current drawer's snapshot carries it, and that
 * drawer-only typed variant lives in `./drawer-private`.
 */
export interface StateSnapshotPayload {
  type: ServerToClientEvent.StateSnapshot;
  /** Room sequence at projection time. */
  version: number;
  /** Server clock, epoch ms, for clock-offset / countdown rendering. */
  serverNow: number;
  room: SnapshotRoom;
  players: PublicPlayer[];
  you: SnapshotYou;
  game: SnapshotGame;
  round: SnapshotRound;
  correctGuessers: CorrectGuesserEntry[];
  /** Last 30 s while `ROUND_ACTIVE`, otherwise empty. */
  strokes: SnapshotStroke[];
  /** Last 50 chat-ring entries. */
  chat: ChatEntry[];
  scores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
}

// ------------------------------------------------------------ API types -----

export interface SessionResponse {
  playerId: string;
}

export interface RoomCreateResponse {
  roomId: string;
  roomCode: string;
  config: RoomConfig;
}

export interface RoomJoinResponse {
  room: Room;
  isHost: boolean;
}
