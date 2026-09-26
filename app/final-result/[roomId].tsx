import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Route: /final-result/[roomId]
 * Placeholder - UI stage.
 */
export default function FinalResultScreen() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  if (!roomId) {
    return <Redirect href="/" />;
  }
  return null;
}
