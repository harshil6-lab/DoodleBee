import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Route: /round-result/[roomId]
 * Placeholder - UI stage.
 */
export default function RoundResultScreen() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  if (!roomId) {
    return <Redirect href="/" />;
  }
  return null;
}
