import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Route: /lobby/[roomId]
 * Placeholder - UI stage. `roomId` is required by the route contract, so an
 * unmatched deep link falls back to the join screen.
 */
export default function LobbyScreen() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  if (!roomId) {
    return <Redirect href="/join-room" />;
  }
  return null;
}
