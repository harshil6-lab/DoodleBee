/**
 * DrawingCanvas - Skia-based shared canvas for drawer and guesser modes.
 *
 * Drawer mode: accepts touch input, renders local + remote strokes, emits
 * draw:start / draw:move / draw:end socket events.
 * Guesser mode: renders remote strokes only, no touch input accepted.
 *
 * Stroke representation matches `drawing-client-architecture.md` section 3.
 * Phase 5 changed only the surrounding sticker frame - touch handling and
 * stroke rendering are unchanged.
 */
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import type { Point, Stroke as LocalStroke } from '../types';
import type { SnapshotStroke } from '../types';
import { tokens } from '../theme/tokens';

// ---------------------------------------------------------------- Types ---

export interface DrawingCanvasProps {
  isDrawer: boolean;
  strokes: Array<LocalStroke | SnapshotStroke>;
  onDrawStart?: (strokeId: string, strokeSeq: number) => void;
  onDrawMove?: (strokeId: string, pointIndex: number, points: Point[]) => void;
  onDrawEnd?: (strokeId: string) => void;
  testID?: string;
}

// ---------------------------------------------------------------- Helpers ---

function toPixelPoint(
  nx: number,
  ny: number,
  w: number,
  h: number,
): [number, number] {
  return [nx * w, ny * h];
}

function pointsToSvgPath(points: Point[], w: number, h: number): string {
  if (points.length === 0) return '';
  const segments: string[] = [];
  const [sx, sy] = toPixelPoint(points[0].x, points[0].y, w, h);
  segments.push(`M ${sx.toFixed(2)} ${sy.toFixed(2)}`);
  for (let i = 1; i < points.length; i++) {
    const [px, py] = toPixelPoint(points[i].x, points[i].y, w, h);
    segments.push(`L ${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return segments.join(' ');
}

function strokeToSvgPath(
  stroke: LocalStroke | SnapshotStroke,
  w: number,
  h: number,
): string {
  const pts = 'points' in stroke ? stroke.points : [];
  return pointsToSvgPath(pts, w, h);
}

// ---------------------------------------------------------------- Component --

export function DrawingCanvas({
  isDrawer,
  strokes,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  testID,
}: DrawingCanvasProps) {
  const canvasRef = React.useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [pendingStrokeId, setPendingStrokeId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const node = canvasRef.current;
    if (!node?.measure) return;
    node.measure((_x: number, _y: number, w: number, h: number) => {
      setCanvasSize({ width: w, height: h });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build SVG paths for rendering.
  const pathDefs = useMemo(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return [];
    return strokes.map((s) => ({
      id: ('id' in s ? s.id : s.strokeId) as string,
      color: s.color,
      brushSize: s.brushSize,
      svgPath: strokeToSvgPath(s, canvasSize.width, canvasSize.height),
    }));
  }, [strokes, canvasSize]);

  // Touch handling - drawer only.
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => isDrawer,
      onMoveShouldSetPanResponder: () => isDrawer,
      onPanResponderGrant: () => {
        if (!isDrawer || !onDrawStart) return;
        const strokeId = crypto.randomUUID();
        setPendingStrokeId(strokeId);
        onDrawStart(strokeId, 0);
      },
      onPanResponderMove: (_evt) => {
        if (!isDrawer || !onDrawMove || !pendingStrokeId) return;
        const { locationX: cx, locationY: cy } = _evt.nativeEvent;
        if (canvasSize.width === 0 || canvasSize.height === 0) return;
        const nx = Math.max(0, Math.min(1, cx / canvasSize.width));
        const ny = Math.max(0, Math.min(1, cy / canvasSize.height));
        const point: Point = { x: nx, y: ny };
        // Emit individual points; batching is handled by the parent/store.
        onDrawMove(pendingStrokeId, 0, [point]);
      },
      onPanResponderRelease: () => {
        if (!isDrawer || !onDrawEnd || !pendingStrokeId) return;
        onDrawEnd(pendingStrokeId);
        setPendingStrokeId(null);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDrawer,
    onDrawStart,
    onDrawMove,
    onDrawEnd,
    canvasSize,
    pendingStrokeId,
  ]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.canvasWrapper} {...panResponder.panHandlers}>
        <Canvas ref={canvasRef} style={styles.canvas} opaque={false}>
          {(() => {
            const bgPath = Skia.Path.MakeFromSVGString('M 0 0 H 1 V 1 H 0 Z');
            if (!bgPath) return null;
            return (
              <Path
                path={bgPath}
                color={tokens.colors.background}
                style="fill"
              />
            );
          })()}
          <Group>
            {pathDefs.map(({ id, color, brushSize: size, svgPath }) => {
              if (!svgPath) return null;
              return (
                <Path
                  key={id}
                  path={svgPath}
                  color={color}
                  strokeWidth={size}
                  style="stroke"
                  strokeCap="round"
                  strokeJoin="round"
                />
              );
            })}
          </Group>
        </Canvas>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: tokens.spacing.md,
    borderWidth: tokens.border.comic,
    borderColor: tokens.colors.ink,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.white,
  },
  canvasWrapper: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});
