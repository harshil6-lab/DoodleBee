/**
 * The server -> client emitter boundary (`realtime-contract.md` section 4).
 *
 * Game services depend on this interface, never on Socket.IO directly, so the
 * transport stays in `src/realtime/` and a unit test can substitute a spy.
 *
 * The two player-scoped methods resolve the target's live socket ids from
 * `room:{id}:sockets`. Drawer-private payloads go to a player id and nowhere
 * else; the "room except the drawer" variant takes the same player id and
 * excludes exactly that set. There is deliberately no room whose membership is
 * the drawer (`realtime-contract.md` section 4).
 */

export interface Bus {
  /** `io.to(room:{roomId})`. */
  toRoom(roomId: string, event: string, payload: unknown): void;
  /** `io.to(room:{roomId}).except(<the player's socket ids>)`. */
  toRoomExceptPlayer(
    roomId: string,
    excludePlayerId: string,
    event: string,
    payload: unknown,
  ): Promise<void>;
  /** The player's own socket ids only (drawer-private payloads). */
  toPlayer(
    roomId: string,
    playerId: string,
    event: string,
    payload: unknown,
  ): Promise<void>;
  /** One specific socket, used before a socket is bound to a room. */
  toSocket(socketId: string, event: string, payload: unknown): void;
  /** Every established socket with a room, used for `SERVER_SHUTDOWN`. */
  toAllRooms(event: string, payload: unknown): void;
}
