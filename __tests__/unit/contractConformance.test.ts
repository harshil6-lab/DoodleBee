/**
 * Contract conformance for the Stage 03 additive client contract
 * (`testing-strategy.md` section 9, `decision.md` D03-024).
 *
 * `realtime-contract.md` section 8 requires E-01 ... E-05 to be applied to
 * `src/types/index.ts`. This suite locks the wire names those entries must use
 * and the secret-word boundary of `reconnect-protocol.md` section 4:
 *  - the public `response:state:snapshot` type never requires a secret word;
 *  - the drawer-only variant requires it.
 *
 * `decision.md` section 2.23 (D03-023, amended v1.1) extends the same suite
 * (open condition OC-7) with the two documented parity relationships between
 * the authoritative contract under `shared/contract/` and the hand-maintained
 * client projection:
 *  - payload-field-set parity, and
 *  - constant-value parity (`shared/contract/constants.ts` vs
 *    `src/validation/schemas.ts`).
 *
 * Locked names, field sets and values are duplicated here on purpose: this is
 * the drift guard, so it must not be derived from the value it is checking.
 *
 * `shared/contract/**` imports its siblings with `.js` specifiers, which the
 * Jest resolver cannot follow. Everything imported from it below is therefore
 * either type-only (erased by Babel) or a module with no relative imports
 * (`constants.ts`).
 */
import type { z } from 'zod';
import { ClientToServerEvent, ServerToClientEvent } from '../../src/types';
import type {
  CanvasClearedPayload,
  ChatEntry,
  ChatMessagePayload,
  CorrectGuesserEntry,
  GameFinishedPayload,
  GuessCorrectPayload,
  GuessSubmittedPayload,
  LeaderboardEntry,
  PlayerDisconnectedPayload,
  PlayerReconnectedPayload,
  PublicDrawerSelectedPayload,
  PublicPlayer,
  RoomConfig,
  RoomConfigUpdatedPayload,
  RoundEndedPayload,
  RoundStartedPayload,
  RoundTimerState,
  ScoreUpdatedPayload,
  SnapshotGame,
  SnapshotRoom,
  SnapshotRound,
  SnapshotStroke,
  SnapshotYou,
  StateSnapshotPayload,
} from '../../src/types';
import type {
  DrawerSelectedPayload,
  DrawerStateSnapshot,
} from '../../src/types/drawer-private';
import * as sharedConstants from '../../shared/contract/constants';
import * as clientSchemas from '../../src/validation/schemas';
import type {
  ChatEntry as SharedChatEntry,
  DrawerSelectedPrivate,
  SERVER_TO_CLIENT_SCHEMAS,
} from '../../shared/contract/server-payloads';
import type {
  CorrectGuesserEntry as SharedCorrectGuesserEntry,
  SnapshotGame as SharedSnapshotGame,
  SnapshotRoom as SharedSnapshotRoom,
  SnapshotRound as SharedSnapshotRound,
  SnapshotYou as SharedSnapshotYou,
} from '../../shared/contract/snapshot';
import type {
  LeaderboardEntry as SharedLeaderboardEntry,
  PublicPlayer as SharedPublicPlayer,
  RoomConfig as SharedRoomConfig,
  RoundTimerState as SharedRoundTimerState,
  Stroke as SharedStroke,
} from '../../shared/contract/types';

const publicSnapshot: StateSnapshotPayload = {
  type: ServerToClientEvent.StateSnapshot,
  version: 7,
  serverNow: 1_700_000_000_000,
  room: {
    roomId: 'room-1',
    roomCode: 'ABCDE',
    roomName: 'Friday night',
    status: 'IN_GAME',
    hostPlayerId: 'p-1',
    config: {
      roomName: 'Friday night',
      maxPlayers: 8,
      rounds: 3,
      roundDuration: 80,
      hints: 2,
    },
  },
  players: [
    {
      playerId: 'p-1',
      nickname: 'host',
      score: 0,
      isConnected: true,
      isHost: true,
      seatOrder: 0,
    },
  ],
  you: {
    playerId: 'p-2',
    nickname: 'guesser',
    role: 'GUESSER',
    score: 0,
    hasGuessedCorrectly: false,
  },
  game: {
    gameId: 'game-1',
    phase: 'ROUND_ACTIVE',
    roundNumber: 1,
    roundsPlanned: 3,
  },
  round: {
    roundId: 'round-1',
    drawerPlayerId: 'p-1',
    maskedWord: '_ _ _ _ _',
    revealedPositions: [],
    hintsRemaining: 2,
    timer: { roundEndTime: 1_700_000_090_000, paused: false },
  },
  correctGuessers: [],
  strokes: [],
  chat: [],
  scores: { 'p-1': 0, 'p-2': 0 },
  leaderboard: [],
};

/** True only when `K` is a property that cannot be omitted. */
type IsRequired<T, K extends keyof T> = undefined extends T[K] ? false : true;

/** True only when `A` and `B` are the same type. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Compile-time assertion carrier: only `true` satisfies the constraint. */
type Expect<T extends true> = T;

/** Every property name of a payload shape. Key order cannot matter. */
type KeysOf<T> = keyof T;

/** `A` is contained in `B` - the documented "typed projection" relation. */
type IsSubset<A, B> = [A] extends [B] ? true : false;

type Registry = typeof SERVER_TO_CLIENT_SCHEMAS;

/** The authoritative field set of one registered server -> client payload. */
type SharedPayloadFields<K extends keyof Registry> = keyof z.infer<Registry[K]>;

const E_01_TO_E_05_SERVER_EVENTS = [
  'room:config:updated',
  'chat:message',
  'player:disconnected',
  'player:reconnected',
  'canvas:cleared',
  'response:state:snapshot',
] as const;
describe('Stage 03 additive contract (E-01 ... E-05)', () => {
  it('locks every additive wire name', () => {
    expect(ServerToClientEvent.RoomConfigUpdated).toBe('room:config:updated');
    expect(ServerToClientEvent.ChatMessage).toBe('chat:message');
    expect(ServerToClientEvent.PlayerDisconnected).toBe('player:disconnected');
    expect(ServerToClientEvent.PlayerReconnected).toBe('player:reconnected');
    expect(ServerToClientEvent.CanvasCleared).toBe('canvas:cleared');
    expect(ServerToClientEvent.StateSnapshot).toBe('response:state:snapshot');
    expect(ClientToServerEvent.RequestStateSnapshot).toBe(
      'request:state:snapshot',
    );
  });

  it('registers every additive server event exactly once', () => {
    const declared = Object.values(ServerToClientEvent);
    for (const name of E_01_TO_E_05_SERVER_EVENTS) {
      expect(declared.filter((value) => value === name)).toHaveLength(1);
    }
    expect(Object.values(ClientToServerEvent)).toContain(
      'request:state:snapshot',
    );
  });

  it('never requires the secret word in the public snapshot', () => {
    const publicSecretIsOptional: IsRequired<
      StateSnapshotPayload['round'],
      'secretWord'
    > = false;

    expect('secretWord' in publicSnapshot.round).toBe(false);
    expect(JSON.stringify(publicSnapshot)).not.toContain('secretWord');
    expect(publicSecretIsOptional).toBe(false);
  });

  it('requires the secret word in the drawer-private snapshot variant', () => {
    const drawerSecretIsRequired: IsRequired<
      DrawerStateSnapshot['round'],
      'secretWord'
    > = true;

    const drawerSnapshot: DrawerStateSnapshot = {
      ...publicSnapshot,
      round: { ...publicSnapshot.round, secretWord: 'elephant' },
    };

    expect(drawerSnapshot.round.secretWord).toBe('elephant');
    expect(drawerSecretIsRequired).toBe(true);
  });
});

// ------------------------------------------------------------ OC-7 parity ----

/**
 * OC-7, half one: the exact field list of every server -> client payload
 * declared in `SERVER_TO_CLIENT_SCHEMAS` (`Execution.md` EXEC-013 section 5).
 * A payload added, renamed or reshaped in the authoritative contract fails
 * here instead of drifting silently.
 */
type RegistryKeySet = Expect<
  Equal<
    keyof Registry,
    | 'room:joined'
    | 'player:joined'
    | 'player:left'
    | 'host:transferred'
    | 'game:started'
    | 'round:started'
    | 'drawer:selected'
    | 'draw:start'
    | 'draw:move'
    | 'draw:end'
    | 'guess:submitted'
    | 'guess:correct'
    | 'hint:revealed'
    | 'round:ended'
    | 'score:updated'
    | 'game:finished'
    | 'connection:lost'
    | 'room:config:updated'
    | 'chat:message'
    | 'canvas:cleared'
    | 'player:disconnected'
    | 'player:reconnected'
    | 'response:state:snapshot'
  >
>;

type RegistryFieldSets = {
  'room:joined': Expect<
    Equal<
      SharedPayloadFields<'room:joined'>,
      'type' | 'version' | 'serverNow' | 'room' | 'players' | 'you'
    >
  >;
  'player:joined': Expect<
    Equal<SharedPayloadFields<'player:joined'>, 'type' | 'player' | 'version'>
  >;
  'player:left': Expect<
    Equal<
      SharedPayloadFields<'player:left'>,
      'type' | 'playerId' | 'reason' | 'version'
    >
  >;
  'host:transferred': Expect<
    Equal<
      SharedPayloadFields<'host:transferred'>,
      'type' | 'hostPlayerId' | 'version'
    >
  >;
  'game:started': Expect<
    Equal<
      SharedPayloadFields<'game:started'>,
      | 'type'
      | 'gameId'
      | 'roundNumber'
      | 'roundsPlanned'
      | 'startingDeadline'
      | 'serverNow'
      | 'players'
      | 'version'
    >
  >;
  'round:started': Expect<
    Equal<
      SharedPayloadFields<'round:started'>,
      | 'type'
      | 'roomId'
      | 'roundNumber'
      | 'drawerPlayerId'
      | 'maskedWord'
      | 'hintsRemaining'
      | 'timer'
      | 'serverNow'
      | 'version'
    >
  >;
  'drawer:selected': Expect<
    Equal<
      SharedPayloadFields<'drawer:selected'>,
      'type' | 'playerId' | 'maskedWord' | 'roundNumber' | 'version'
    >
  >;
  'draw:start': Expect<
    Equal<
      SharedPayloadFields<'draw:start'>,
      | 'type'
      | 'strokeId'
      | 'strokeSeq'
      | 'color'
      | 'brushSize'
      | 'points'
      | 'version'
    >
  >;
  'draw:move': Expect<
    Equal<
      SharedPayloadFields<'draw:move'>,
      'type' | 'strokeId' | 'pointIndex' | 'points' | 'version'
    >
  >;
  'draw:end': Expect<
    Equal<SharedPayloadFields<'draw:end'>, 'type' | 'strokeId' | 'version'>
  >;
  'guess:submitted': Expect<
    Equal<
      SharedPayloadFields<'guess:submitted'>,
      'type' | 'playerId' | 'nickname' | 'text' | 'result' | 'version'
    >
  >;
  'guess:correct': Expect<
    Equal<
      SharedPayloadFields<'guess:correct'>,
      | 'type'
      | 'playerId'
      | 'nickname'
      | 'rank'
      | 'points'
      | 'correctCount'
      | 'version'
    >
  >;
  'hint:revealed': Expect<
    Equal<
      SharedPayloadFields<'hint:revealed'>,
      'type' | 'maskedWord' | 'revealedPositions' | 'hintsRemaining' | 'version'
    >
  >;
  'round:ended': Expect<
    Equal<
      SharedPayloadFields<'round:ended'>,
      | 'type'
      | 'roundNumber'
      | 'endReason'
      | 'word'
      | 'rankings'
      | 'drawerBonus'
      | 'drawerPoints'
      | 'version'
    >
  >;
  'score:updated': Expect<
    Equal<SharedPayloadFields<'score:updated'>, 'type' | 'scores' | 'version'>
  >;
  'game:finished': Expect<
    Equal<
      SharedPayloadFields<'game:finished'>,
      'type' | 'finalScores' | 'rankings' | 'winnerId' | 'version'
    >
  >;
  'connection:lost': Expect<
    Equal<SharedPayloadFields<'connection:lost'>, 'type' | 'code' | 'retryable'>
  >;
  'room:config:updated': Expect<
    Equal<
      SharedPayloadFields<'room:config:updated'>,
      'type' | 'config' | 'version'
    >
  >;
  'chat:message': Expect<
    Equal<
      SharedPayloadFields<'chat:message'>,
      | 'type'
      | 'id'
      | 'messageType'
      | 'senderPlayerId'
      | 'senderNickname'
      | 'text'
      | 'createdAt'
      | 'version'
    >
  >;
  'canvas:cleared': Expect<
    Equal<
      SharedPayloadFields<'canvas:cleared'>,
      'type' | 'roundNumber' | 'version'
    >
  >;
  'player:disconnected': Expect<
    Equal<
      SharedPayloadFields<'player:disconnected'>,
      'type' | 'playerId' | 'graceDeadline' | 'version'
    >
  >;
  'player:reconnected': Expect<
    Equal<
      SharedPayloadFields<'player:reconnected'>,
      'type' | 'playerId' | 'version'
    >
  >;
  'response:state:snapshot': Expect<
    Equal<
      SharedPayloadFields<'response:state:snapshot'>,
      | 'type'
      | 'version'
      | 'serverNow'
      | 'room'
      | 'players'
      | 'you'
      | 'game'
      | 'round'
      | 'correctGuessers'
      | 'strokes'
      | 'chat'
      | 'scores'
      | 'leaderboard'
    >
  >;
};

/**
 * OC-7, half one continued: the client payloads that `src/types/index.ts`
 * documents as `mirroring` `shared/contract/server-payloads.ts` (the E-01 ...
 * E-05 additions) must match the authoritative field set exactly.
 */
type MirroredPayloadFieldSets = {
  'room:config:updated': Expect<
    Equal<
      KeysOf<RoomConfigUpdatedPayload>,
      SharedPayloadFields<'room:config:updated'>
    >
  >;
  'chat:message': Expect<
    Equal<KeysOf<ChatMessagePayload>, SharedPayloadFields<'chat:message'>>
  >;
  'guess:submitted': Expect<
    Equal<KeysOf<GuessSubmittedPayload>, SharedPayloadFields<'guess:submitted'>>
  >;
  'player:disconnected': Expect<
    Equal<
      KeysOf<PlayerDisconnectedPayload>,
      SharedPayloadFields<'player:disconnected'>
    >
  >;
  'player:reconnected': Expect<
    Equal<
      KeysOf<PlayerReconnectedPayload>,
      SharedPayloadFields<'player:reconnected'>
    >
  >;
  'canvas:cleared': Expect<
    Equal<KeysOf<CanvasClearedPayload>, SharedPayloadFields<'canvas:cleared'>>
  >;
  'response:state:snapshot': Expect<
    Equal<
      KeysOf<StateSnapshotPayload>,
      SharedPayloadFields<'response:state:snapshot'>
    >
  >;
};

/**
 * The Stage 02 payloads `decision.md` section 2.23 calls "a typed projection
 * checked against it": every client field must exist in the authoritative
 * schema. The client is deliberately narrower (EXEC-013 section 6).
 */
type ProjectedPayloadFieldSets = {
  'drawer:selected': Expect<
    IsSubset<
      KeysOf<PublicDrawerSelectedPayload>,
      SharedPayloadFields<'drawer:selected'>
    >
  >;
  'drawer:selected (drawer-private)': Expect<
    IsSubset<KeysOf<DrawerSelectedPayload>, KeysOf<DrawerSelectedPrivate>>
  >;
  'guess:correct': Expect<
    IsSubset<KeysOf<GuessCorrectPayload>, SharedPayloadFields<'guess:correct'>>
  >;
  'score:updated': Expect<
    IsSubset<KeysOf<ScoreUpdatedPayload>, SharedPayloadFields<'score:updated'>>
  >;
  'game:finished': Expect<
    IsSubset<KeysOf<GameFinishedPayload>, SharedPayloadFields<'game:finished'>>
  >;
};

/**
 * `RoundStartedPayload` and `RoundEndedPayload` are the two client payloads
 * that are NOT projections of the authoritative schema: each carries one
 * client-only field (`phase`, `winnerPlayerId`). EXEC-012 section 5 records
 * the divergence and EXEC-013 section 3 leaves it in place ("the client's own
 * projection of the contract"). These assertions pin both sides so the
 * accepted divergence cannot drift; they do not claim field-set equality.
 */
type RecordedClientDivergences = {
  'round:started': Expect<
    Equal<
      KeysOf<RoundStartedPayload>,
      'type' | 'phase' | 'timer' | 'maskedWord' | 'hintsRemaining'
    >
  >;
  'round:ended': Expect<
    Equal<KeysOf<RoundEndedPayload>, 'type' | 'winnerPlayerId' | 'rankings'>
  >;
};

type RecordedDivergenceIsClientOnly = {
  'round:started': Expect<
    Equal<
      Exclude<
        KeysOf<RoundStartedPayload>,
        SharedPayloadFields<'round:started'>
      >,
      'phase'
    >
  >;
  'round:ended': Expect<
    Equal<
      Exclude<KeysOf<RoundEndedPayload>, SharedPayloadFields<'round:ended'>>,
      'winnerPlayerId'
    >
  >;
};

/** The E-05 snapshot sub-shapes, which mirror the shared snapshot exactly. */
type SnapshotFieldSets = {
  room: Expect<Equal<KeysOf<SnapshotRoom>, KeysOf<SharedSnapshotRoom>>>;
  players: Expect<Equal<KeysOf<PublicPlayer>, KeysOf<SharedPublicPlayer>>>;
  you: Expect<Equal<KeysOf<SnapshotYou>, KeysOf<SharedSnapshotYou>>>;
  game: Expect<Equal<KeysOf<SnapshotGame>, KeysOf<SharedSnapshotGame>>>;
  round: Expect<Equal<KeysOf<SnapshotRound>, KeysOf<SharedSnapshotRound>>>;
  correctGuessers: Expect<
    Equal<KeysOf<CorrectGuesserEntry>, KeysOf<SharedCorrectGuesserEntry>>
  >;
  strokes: Expect<Equal<KeysOf<SnapshotStroke>, KeysOf<SharedStroke>>>;
  chat: Expect<Equal<KeysOf<ChatEntry>, KeysOf<SharedChatEntry>>>;
  leaderboard: Expect<
    Equal<KeysOf<LeaderboardEntry>, KeysOf<SharedLeaderboardEntry>>
  >;
  timer: Expect<Equal<KeysOf<RoundTimerState>, KeysOf<SharedRoundTimerState>>>;
  roomConfig: Expect<Equal<KeysOf<RoomConfig>, KeysOf<SharedRoomConfig>>>;
};

describe('OC-7 payload field-set parity', () => {
  it('registers exactly the documented server -> client payload set', () => {
    const registryKeys: RegistryKeySet = true;

    expect(registryKeys).toBe(true);
    expect(Object.keys(registryFieldSets)).toHaveLength(23);
  });

  it('locks the exact field list of every registered payload', () => {
    expect(Object.values(registryFieldSets).every(Boolean)).toBe(true);
  });

  it('keeps every mirrored client payload field-for-field equal', () => {
    expect(Object.values(mirroredPayloadFieldSets).every(Boolean)).toBe(true);
  });

  it('keeps every projected client payload a subset of its schema', () => {
    expect(Object.values(projectedPayloadFieldSets).every(Boolean)).toBe(true);
  });

  it('pins the two divergences recorded by EXEC-012 / EXEC-013', () => {
    const clientFields: RecordedClientDivergences = {
      'round:started': true,
      'round:ended': true,
    };
    const clientOnlyFields: RecordedDivergenceIsClientOnly = {
      'round:started': true,
      'round:ended': true,
    };

    expect(Object.values(clientFields).every(Boolean)).toBe(true);
    expect(Object.values(clientOnlyFields).every(Boolean)).toBe(true);
  });

  it('keeps every snapshot sub-shape field-for-field equal', () => {
    expect(Object.values(snapshotFieldSets).every(Boolean)).toBe(true);
  });
});

// -------------------------------------------------------- OC-7 constants ----

/**
 * Every name exported by BOTH `shared/contract/constants.ts` and
 * `src/validation/schemas.ts` (the two documented sides of "constant-value
 * parity", `decision.md` section 2.23 / OC-7). Constants that exist on only
 * one side (server-only timings, rate limits, ...) are not parity pairs and
 * are deliberately absent.
 */
const SHARED_CLIENT_CONSTANTS = [
  'MAX_CHAT_MESSAGE_LENGTH',
  'MAX_GUESS_LENGTH',
  'MAX_HINTS',
  'MAX_PLAYERS',
  'MAX_ROUNDS',
  'MAX_ROUND_DURATION_SECONDS',
  'MIN_HINTS',
  'MIN_PLAYERS',
  'MIN_ROUNDS',
  'MIN_ROUND_DURATION_SECONDS',
  'NICKNAME_MAX_LENGTH',
  'NICKNAME_MIN_LENGTH',
  'ROOM_CODE_ALPHABET',
  'ROOM_CODE_MAX_LENGTH',
  'ROOM_CODE_MIN_LENGTH',
  'ROOM_CODE_REGEX',
  'ROOM_NAME_MAX_LENGTH',
] as const;

const registryFieldSets: RegistryFieldSets = {
  'room:joined': true,
  'player:joined': true,
  'player:left': true,
  'host:transferred': true,
  'game:started': true,
  'round:started': true,
  'drawer:selected': true,
  'draw:start': true,
  'draw:move': true,
  'draw:end': true,
  'guess:submitted': true,
  'guess:correct': true,
  'hint:revealed': true,
  'round:ended': true,
  'score:updated': true,
  'game:finished': true,
  'connection:lost': true,
  'room:config:updated': true,
  'chat:message': true,
  'canvas:cleared': true,
  'player:disconnected': true,
  'player:reconnected': true,
  'response:state:snapshot': true,
};

const mirroredPayloadFieldSets: MirroredPayloadFieldSets = {
  'room:config:updated': true,
  'chat:message': true,
  'guess:submitted': true,
  'player:disconnected': true,
  'player:reconnected': true,
  'canvas:cleared': true,
  'response:state:snapshot': true,
};

const projectedPayloadFieldSets: ProjectedPayloadFieldSets = {
  'drawer:selected': true,
  'drawer:selected (drawer-private)': true,
  'guess:correct': true,
  'score:updated': true,
  'game:finished': true,
};

const snapshotFieldSets: SnapshotFieldSets = {
  room: true,
  players: true,
  you: true,
  game: true,
  round: true,
  correctGuessers: true,
  strokes: true,
  chat: true,
  leaderboard: true,
  timer: true,
  roomConfig: true,
};

describe('OC-7 constant-value parity', () => {
  it('re-declares exactly the shared constants on the client', () => {
    const sharedNames = Object.keys(sharedConstants);
    const clientNames = Object.keys(clientSchemas);
    const intersection = sharedNames
      .filter((name) => clientNames.includes(name))
      .sort();

    expect(intersection).toEqual([...SHARED_CLIENT_CONSTANTS]);
  });

  it('keeps every shared/client constant at the same value', () => {
    for (const name of SHARED_CLIENT_CONSTANTS) {
      expect(sharedConstants[name]).toBeDefined();
      expect(clientSchemas[name]).toBeDefined();
      expect(clientSchemas[name]).toEqual(sharedConstants[name]);
    }
  });
});
