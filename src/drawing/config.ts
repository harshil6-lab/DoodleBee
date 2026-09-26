/**
 * Drawing foundation constants (ADR sections 13.2-13.4).
 *
 * The concrete canvas component, local stroke capture and realtime stroke
 * transport belong to Stage 3. This module only centralizes the limits that
 * the ADR already fixed, so no drawing rule is duplicated later.
 *
 * Drawing library: `@shopify/react-native-skia` (ADR AD-004, conditional).
 * SDK compatibility for Expo SDK 57 is confirmed - 2.6.2 is the version
 * pinned by `expo/bundledNativeModules.json` and installed here. The ADR's
 * device performance test (60fps local rendering, 8 concurrent viewers,
 * <200ms propagation) is still outstanding, so the decision is not marked
 * LOCKED (see docs/agent-runs/02-client-architecture/Build.md).
 */
export const DRAW_MOVE_BATCH_SIZE = 10;
export const MAX_POINTS_PER_STROKE = 300;
export const STROKE_HISTORY_MS = 30_000;

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 20;
export const DEFAULT_BRUSH_SIZE = 8;
export const DEFAULT_STROKE_COLOR = '#000000';

export const drawingLimits = {
  drawMoveBatchSize: DRAW_MOVE_BATCH_SIZE,
  maxPointsPerStroke: MAX_POINTS_PER_STROKE,
  strokeHistoryMs: STROKE_HISTORY_MS,
} as const;
