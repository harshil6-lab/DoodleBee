/**
 * ConnectionBanner — cross-cutting overlay for connection state.
 *
 * Renders at the root layout level per D04-009.
 * Reads `useConnectionStore()` and shows appropriate message per status.
 */
import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { tokens } from '../theme/tokens';
import { useConnectionStore } from '../stores/connection.store';
import { connectSocket } from '../realtime/socket';
import { useSessionStore } from '../stores/session.store';

// ---------------------------------------------------------------- Component --

export function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  const lastError = useConnectionStore((s) => s.lastError);

  if (status === 'connected' || status === 'reconnected') {
    return null;
  }

  const getMessage = (): string => {
    switch (status) {
      case 'disconnected':
        return lastError ?? 'Your connection disappeared.';
      case 'reconnecting':
        return 'Finding your friends...';
      case 'expired':
        return 'Session expired. Please re-enter your nickname.';
      default:
        return '';
    }
  };

  const handleRetry = () => {
    const token = useSessionStore.getState().sessionToken;
    if (token) {
      connectSocket(token);
    }
  };

  return (
    <View
      style={[styles.banner, getBannerStyle(status)]}
      testID="connection-banner"
    >
      <Text style={styles.bannerText}>{getMessage()}</Text>
      {status === 'disconnected' ? (
        <Pressable onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Helpers ---

function getBannerStyle(status: string): object {
  switch (status) {
    case 'disconnected':
      return { backgroundColor: tokens.colors.danger };
    case 'reconnecting':
      return { backgroundColor: tokens.colors.warning };
    case 'expired':
      return { backgroundColor: tokens.colors.danger };
    default:
      return {};
  }
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: tokens.zIndex.connectionBanner,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: tokens.colors.textInverse,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: tokens.colors.textInverse,
  },
});
