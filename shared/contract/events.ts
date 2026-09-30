/**
 * Event names (Stage 03 `realtime-contract.md` sections 6 and 7).
 *
 * Locked names come from the Stage 02 client contract
 * (`src/types/index.ts` -> `ClientToServerEvent` / `ServerToClientEvent`) and
 * MUST NOT be renamed. Names introduced by Stage 03 are marked below with the
 * decision that introduced them (D03-030).
 */

/** Client -> server. `request:state:snapshot` is new in Stage 03 (AD-009). */
export const CLIENT_TO_SERVER_EVENTS = [
  'join:room',
  'leave:room',
  'guess:submit',
  'chat:message',
  'hint:request',
  'game:start',
  'draw:start',
  'draw:move',
  'draw:end',
  'canvas:clear',
  'request:state:snapshot',
] as const;
export type ClientToServerEventName = (typeof CLIENT_TO_SERVER_EVENTS)[number];

/** Server -> client. The last six are new in Stage 03 (D03-030). */
export const SERVER_TO_CLIENT_EVENTS = [
  'room:joined',
  'player:joined',
  'player:left',
  'host:transferred',
  'game:started',
  'round:started',
  'drawer:selected',
  'draw:start',
  'draw:move',
  'draw:end',
  'guess:submitted',
  'guess:correct',
  'hint:revealed',
  'round:ended',
  'score:updated',
  'game:finished',
  'connection:lost',
  'room:config:updated',
  'chat:message',
  'canvas:cleared',
  'player:disconnected',
  'player:reconnected',
  'response:state:snapshot',
] as const;
export type ServerToClientEventName = (typeof SERVER_TO_CLIENT_EVENTS)[number];

/**
 * The two server payloads that are allowed to carry the secret word
 * (`security-model.md` section 3, D03-015). Every other registered server
 * payload schema is scanned by a test that fails if `secretWord` appears.
 */
export const SECRET_WORD_CARRYING_EVENTS = [
  'drawer:selected',
  'response:state:snapshot',
] as const;
