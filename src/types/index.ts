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
