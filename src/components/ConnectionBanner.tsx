/**
 * ConnectionBanner - cross-cutting overlay for connection state.
 *
 * Renders at the root layout level per D04-009.
 * Reads `useConnectionStore()` and shows appropriate message per status.
 * Auto-dismisses the "reconnected" banner after 2s via an async timeout
 * callback (never calls setState synchronously inside the effect body).
 * Stays visible for disconnected/reconnecting/expired states.
 *
 * Phase 5 restyled this banner into the approved comic language. The
 * lifecycle logic below is unchanged.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';
import { useConnectionStore } from '../stores/connection.store';
import { connectSocket } from '../realtime/socket';
import { useSessionStore } from '../stores/session.store';

// ---------------------------------------------------------------- Component --

export function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  const lastError = useConnectionStore((s) => s.lastError);

  // Timer handle stored in a ref so it survives re-renders without
  // requiring setState in the effect body.
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Cancel any pending dismissal from a previous reconnected cycle.
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (status === 'reconnected') {
      // Schedule dismissal via async callback only - never call setState
      // synchronously inside this effect body.
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        setDismissed(true);
      }, 2000);
    }
    // For all other statuses (connected, disconnected, reconnecting, expired),
    // the banner shows regardless of the dismissed flag; no state change needed.

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [status]);

  // Hide the banner after the 2s auto-dismiss timer fires while reconnected.
  if ((status === 'connected' || status === 'reconnected') && dismissed) {
    return null;
  }

  // Hidden when fully connected with no issue.
  if (status === 'connected') {
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
      case 'reconnected':
        return 'Welcome back!';
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
        <Pressable onPress={handleRetry} style={styles.retrySlot}>
          <ComicSurface
            variant="sticker"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.beeYellow}
            offset={2}
            contentStyle={styles.retryFace}
          >
            <Text style={styles.retryText}>RETRY</Text>
          </ComicSurface>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Helpers ---

function getBannerStyle(status: string): object {
  switch (status) {
    case 'disconnected':
      return {
        backgroundColor: tokens.colors.hotPink,
        borderBottomColor: tokens.colors.ink,
      };
    case 'reconnecting':
      return {
        backgroundColor: tokens.colors.beeYellow,
        borderBottomColor: tokens.colors.ink,
      };
    case 'expired':
      return {
        backgroundColor: tokens.colors.hotPink,
        borderBottomColor: tokens.colors.ink,
      };
    case 'reconnected':
      return {
        backgroundColor: tokens.colors.mint,
        borderBottomColor: tokens.colors.ink,
      };
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
    borderBottomWidth: tokens.border.comic,
    paddingVertical: 12,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
  },
  bannerText: {
    flex: 1,
    ...tokens.typography.bodyBold,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  retrySlot: {
    minWidth: 92,
  },
  retryFace: {
    paddingVertical: 6,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
  },
  retryText: {
    ...tokens.typography.button,
    fontSize: 15,
    color: tokens.colors.ink,
  },
});
