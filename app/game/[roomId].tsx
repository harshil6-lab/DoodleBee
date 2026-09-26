import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Route: /game/[roomId]
 * Core gameplay screen; drawer vs guesser is game state, not a route
 * (ProjectDocs/01-information-architecture.md section 25).
 * Placeholder - UI stage.
 */
export default function GameScreen() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  if (!roomId) {
    return <Redirect href="/" />;
  }
  return null;
}
