/**
 * Route: /game/[roomId]
 *
 * Core gameplay screen. Role dispatch is server-authoritative:
 * - DRAWER: DrawingCanvas (touch-enabled) + DrawingToolbar
 * - GUESSER: DrawingCanvas (read-only) + GuesserPanel
 *
 * Both modes share: GameHeader, ChatPanel, ConnectionBanner (root-level).
 * Navigation on round:ended -> /round-result/:roomId
 * Navigation on game:finished -> /final-result/:roomId
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { DrawingCanvas } from '@/components/DrawingCanvas';
import { DrawingToolbar } from '@/components/DrawingToolbar';
import { GameHeader } from '@/components/GameHeader';
import { PaperBackground } from '@/components/ui/PaperBackground';
import { GuesserPanel } from '@/components/GuesserPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { tokens } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { useDrawerGameStore } from '@/stores/drawer.store';
import { useGuesserGameStore } from '@/stores/guesser.store';
import { useRoomStore } from '@/stores/room.store';
import { useSessionStore } from '@/stores/session.store';
import { useUiStore } from '@/stores/ui.store';
import {
  emitWithoutAck,
  on,
  isConnected,
  joinRoom as joinRoomSocket,
  leaveRoom as leaveRoomSocket,
} from '@/realtime/socket';
import { ClientToServerEvent, ServerToClientEvent } from '@/types';
import type { Stroke, Point } from '@/types';
import { env } from '@/config/env';
import { probeT0 } from '@/utils/probe';

// strokeSeq is a module-level counter for the drawer per round.
const strokeSeqRef = { current: 0 };

// ---------------------------------------------------------------- Game Screen --

export default function GameScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();

  // ── All hooks before any early return ──────────────────────────────────
  const playerId = useSessionStore((s) => s.playerId);
  const sessionToken = useSessionStore((s) => s.sessionToken);
  const drawer = useDrawerGameStore((s) => s.drawer);
  const strokes = useDrawerGameStore((s) => s.strokes);
  const selectedColor = useDrawerGameStore((s) => s.selectedColor);
  const brushSize = useDrawerGameStore((s) => s.brushSize);
  const chatExpanded = useUiStore((s) => s.chatExpanded);
  const setChatExpanded = useUiStore((s) => s.setChatExpanded);
  const showToast = useUiStore((s) => s.showToast);
  const clearStrokes = useDrawerGameStore((s) => s.clearStrokes);
  const addStroke = useDrawerGameStore((s) => s.addStroke);

  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      messageType: import('@/components/ChatPanel').ChatMessageType;
      senderPlayerId: string | null;
      senderNickname: string | null;
      text: string;
      createdAt: number;
    }>
  >([]);

  const currentStrokeIdRef = useRef<string | null>(null);
  const currentStrokePointsRef = useRef<Point[]>([]);

  // Role is server-authoritative.
  const role = useMemo(() => {
    if (!playerId || !drawer) return null;
    return playerId === drawer ? 'DRAWER' : 'GUESSER';
  }, [playerId, drawer]);

  // Subscribe to game-relevant server events.
  useEffect(() => {
    if (!env.isSocketConfigured || !roomId) return;

    const unsubRoundEnded = on(ServerToClientEvent.RoundEnded, () => {
      router.replace(`/round-result/${roomId}`);
    });

    const unsubGameFinished = on(ServerToClientEvent.GameFinished, () => {
      router.replace(`/final-result/${roomId}`);
    });

    const unsubCanvasCleared = on(ServerToClientEvent.CanvasCleared, () => {
      clearStrokes();
    });

    const unsubGuessCorrect = on(
      ServerToClientEvent.GuessCorrect,
      (payload: unknown) => {
        const p = payload as {
          playerId: string;
          rank: number;
          points: number;
          version: number;
        };
        if (p.playerId === playerId) {
          showToast(`You guessed correctly! Rank #${p.rank}`, 'success');
        }
      },
    );

    const unsubGuessSubmitted = on(
      ServerToClientEvent.GuessSubmitted,
      (payload: unknown) => {
        const p = payload as {
          playerId: string;
          result: 'WRONG' | 'CLOSE';
          version: number;
        };
        if (p.playerId === playerId) {
          showToast(p.result === 'CLOSE' ? 'Close!' : 'Not quite.', 'info');
        }
      },
    );

    const unsubHintRevealed = on(
      ServerToClientEvent.HintRevealed,
      (payload: unknown) => {
        const p = payload as {
          maskedWord: string;
          hintsRemaining: number;
          version: number;
        };
        useDrawerGameStore.getState().setMaskedWord(p.maskedWord);
        useDrawerGameStore.getState().setHintsRemaining(p.hintsRemaining);
      },
    );

    const unsubScoreUpdated = on(
      ServerToClientEvent.ScoreUpdated,
      (payload: unknown) => {
        const p = payload as {
          scores: Record<string, number>;
          version: number;
        };
        useDrawerGameStore.getState().setScores(p.scores);
      },
    );

    const unsubChatMessage = on(
      ServerToClientEvent.ChatMessage,
      (payload: unknown) => {
        const p = payload as {
          id: string;
          messageType: string;
          senderPlayerId: string | null;
          senderNickname: string | null;
          text: string;
          createdAt: number;
          version: number;
        };
        const chatMsg = p as {
          id: string;
          messageType: import('@/components/ChatPanel').ChatMessageType;
          senderPlayerId: string | null;
          senderNickname: string | null;
          text: string;
          createdAt: number;
        };
        setChatMessages((prev) => [...prev.slice(-49), chatMsg]);
      },
    );

    const unsubDrawerSelected = on(
      ServerToClientEvent.DrawerSelected,
      (payload: unknown) => {
        const p = payload as {
          secretWord?: string;
          maskedWord: string;
          version: number;
        };
        if (p.secretWord) {
          useDrawerGameStore.getState().setSecretWord(p.secretWord);
        }
        useDrawerGameStore.getState().setMaskedWord(p.maskedWord);
      },
    );

    const unsubRoundStarted = on(
      ServerToClientEvent.RoundStarted,
      (payload: unknown) => {
        const p = payload as {
          roundNumber: number;
          drawerPlayerId: string;
          maskedWord: string;
          hintsRemaining: number;
          timer: { roundEndTime: number };
          version: number;
        };
        useDrawerGameStore.getState().setPhase('ROUND_ACTIVE');
        useDrawerGameStore.getState().setDrawer(p.drawerPlayerId);
        useDrawerGameStore.getState().setMaskedWord(p.maskedWord);
        useDrawerGameStore.getState().setHintsRemaining(p.hintsRemaining);
        useDrawerGameStore
          .getState()
          .setTimer({ roundEndTime: p.timer.roundEndTime, paused: false });
        useDrawerGameStore.getState().setRoundNumber(p.roundNumber);
      },
    );

    const unsubSnapshot = on(
      ServerToClientEvent.StateSnapshot,
      (payload: unknown) => {
        const p = payload as {
          version: number;
          you: { role: string; playerId: string };
          game: {
            phase: string;
            roundNumber: number;
            roundsPlanned: number;
          };
          round: {
            drawerPlayerId: string | null;
            maskedWord: string;
            hintsRemaining: number;
            timer: { roundEndTime: number | null; paused: boolean };
            secretWord?: string;
          };
          strokes: Array<{
            strokeId: string;
            color: string;
            brushSize: number;
            points: Array<{ x: number; y: number }>;
          }>;
          scores: Record<string, number>;
        };
        const isDrawerSnap = p.you.role === 'DRAWER';
        const phaseVal = p.game.phase as any;

        if (isDrawerSnap) {
          useDrawerGameStore.getState().setPhase(phaseVal);
          useDrawerGameStore.getState().setDrawer(p.round.drawerPlayerId);
          useDrawerGameStore.getState().setMaskedWord(p.round.maskedWord);
          useDrawerGameStore
            .getState()
            .setHintsRemaining(p.round.hintsRemaining);
          useDrawerGameStore.getState().setTimer(p.round.timer);
          useDrawerGameStore.getState().setRoundNumber(p.game.roundNumber);
          useDrawerGameStore.getState().setRoundsPlanned(p.game.roundsPlanned);
          useDrawerGameStore.getState().setScores(p.scores);
          if (p.round.secretWord) {
            useDrawerGameStore.getState().setSecretWord(p.round.secretWord);
          }
          const restoredStrokes: Stroke[] = (p.strokes ?? []).map((s) => ({
            id: s.strokeId,
            points: s.points,
            color: s.color,
            brushSize: s.brushSize,
            erased: false,
          }));
          useDrawerGameStore.setState({ strokes: restoredStrokes });
        } else {
          useGuesserGameStore.getState().setPhase(phaseVal);
          useGuesserGameStore.getState().setDrawer(p.round.drawerPlayerId);
          useGuesserGameStore.getState().setMaskedWord(p.round.maskedWord);
          useGuesserGameStore
            .getState()
            .setHintsRemaining(p.round.hintsRemaining);
          useGuesserGameStore.getState().setTimer(p.round.timer);
          useGuesserGameStore.getState().setRoundNumber(p.game.roundNumber);
          useGuesserGameStore.getState().setRoundsPlanned(p.game.roundsPlanned);
          useGuesserGameStore.getState().setScores(p.scores);
        }
      },
    );

    const unsubConnectionLost = on(
      ServerToClientEvent.ConnectionLost,
      (payload: unknown) => {
        const p = payload as { code?: string };
        if (p.code === 'SESSION_EXPIRED') {
          useSessionStore.getState().clearAll();
          router.replace('/nickname');
        }
      },
    );

    return () => {
      unsubRoundEnded();
      unsubGameFinished();
      unsubCanvasCleared();
      unsubGuessCorrect();
      unsubGuessSubmitted();
      unsubHintRevealed();
      unsubScoreUpdated();
      unsubChatMessage();
      unsubDrawerSelected();
      unsubRoundStarted();
      unsubSnapshot();
      unsubConnectionLost();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId]);

  // Join room socket on mount.
  useEffect(() => {
    if (!env.isSocketConfigured || !sessionToken || !roomId) return;
    if (!isConnected()) {
      joinRoomSocket(roomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values & handlers (all hooks done before guards) ───────────
  const isDrawer = role === 'DRAWER';

  const handleLeave = useCallback(() => {
    leaveRoomSocket();
    useSessionStore.getState().clearRoom();
    useRoomStore.getState().leaveRoom();
    useUiStore.getState().reset();
    router.replace('/');
  }, [router]);

  const handleDrawStart = useCallback(
    (_strokeId: string) => {
      const strokeId = crypto.randomUUID();
      currentStrokeIdRef.current = strokeId;
      currentStrokePointsRef.current = [];
      const probe = probeT0();
      emitWithoutAck(ClientToServerEvent.DrawStart, {
        strokeId,
        strokeSeq: strokeSeqRef.current++,
        color: selectedColor,
        brushSize,
        points: [],
        ...probe,
      });
      addStroke({
        id: strokeId,
        points: [],
        color: selectedColor,
        brushSize,
        erased: false,
      });
    },
    [selectedColor, brushSize, addStroke],
  );

  const handleDrawMove = useCallback(
    (strokeId: string, _pointIndex: number, points: Point[]) => {
      const probeMove = probeT0();
      emitWithoutAck(ClientToServerEvent.DrawMove, {
        strokeId,
        pointIndex: points.length - 1,
        points,
        ...probeMove,
      });
      const lastPoint = points[points.length - 1];
      if (!lastPoint) return;
      const state = useDrawerGameStore.getState();
      const existing = state.strokes.find((s) => s.id === strokeId);
      if (existing) {
        const updated = {
          ...existing,
          points: [...existing.points, lastPoint],
        };
        useDrawerGameStore.getState().addStroke(updated);
      }
    },
    [],
  );

  const handleDrawEnd = useCallback((_strokeId: string) => {
    currentStrokeIdRef.current = null;
    currentStrokePointsRef.current = [];
  }, []);

  const handleChatSend = useCallback((text: string) => {
    emitWithoutAck(ClientToServerEvent.SendChat, { text });
  }, []);

  // ── Guards (after ALL hooks) ───────────────────────────────────────────
  if (!roomId) {
    return <Redirect href="/" />;
  }

  if (!playerId) {
    return <Redirect href="/nickname" />;
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container} testID="game-screen">
      <PaperBackground />

      {/* Game header */}
      <GameHeader isDrawer={isDrawer} />

      {/* Main area: canvas + side panel */}
      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.mainContent}
      >
        {/* Drawing canvas */}
        <DrawingCanvas
          isDrawer={isDrawer}
          strokes={strokes}
          onDrawStart={isDrawer ? handleDrawStart : undefined}
          onDrawMove={isDrawer ? handleDrawMove : undefined}
          onDrawEnd={isDrawer ? handleDrawEnd : undefined}
          testID="drawing-canvas"
        />

        {/* Role-specific panel */}
        {isDrawer ? <DrawingToolbar /> : <GuesserPanel />}
      </ScrollView>

      {/* Chat panel */}
      <ChatPanel
        expanded={chatExpanded}
        messages={chatMessages}
        onSend={handleChatSend}
        onToggle={() => setChatExpanded(!chatExpanded)}
        testID="chat-panel"
      />

      {/* Leave button (always visible) */}
      <View style={styles.leaveRow}>
        <View style={styles.spacer} />
        <Button
          label="Leave"
          onPress={handleLeave}
          variant="ghost"
          testID="leave-game-button"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    flexGrow: 1,
  },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: tokens.colors.cream,
    borderTopWidth: tokens.border.comic,
    borderTopColor: tokens.colors.ink,
  },
  spacer: { flex: 1 },
});
