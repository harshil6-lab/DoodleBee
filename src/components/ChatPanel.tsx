/**
 * ChatPanel — collapsible message list + input for in-game chat.
 *
 * Messages come from server events (`chat:message`, `guess:submitted`).
 * Ring buffer size is `CHAT_RING_SIZE` from shared contract constants.
 * Max message length enforced client-side via `ChatMessageSchema`.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { Input } from './Input';
import { Button } from './Button';

import { MAX_CHAT_MESSAGE_LENGTH } from '../validation/schemas';

// ---------------------------------------------------------------- Types ---

export type ChatMessageType = 'NORMAL' | 'GUESS' | 'SYSTEM' | 'CORRECT_GUESS';

export interface ChatEntry {
  id: string;
  messageType: ChatMessageType;
  senderPlayerId: string | null;
  senderNickname: string | null;
  text: string;
  createdAt: number;
}

// ---------------------------------------------------------------- Helpers ---

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------- Component --

interface ChatPanelProps {
  expanded: boolean;
  messages: ChatEntry[];
  onSend: (text: string) => void;
  onToggle: () => void;
  testID?: string;
}

export function ChatPanel({
  expanded,
  messages,
  onSend,
  onToggle,
  testID,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<ChatEntry>>(null);

  useEffect(() => {
    if (expanded) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [expanded, messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Message cannot be empty');
      return;
    }
    if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
      setError(
        `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer`,
      );
      return;
    }
    setError(null);
    onSend(trimmed);
    setInput('');
  }, [input, onSend]);

  const messageColor = useMemo(
    () => (type: ChatMessageType) => {
      switch (type) {
        case 'CORRECT_GUESS':
          return tokens.colors.accentMint;
        case 'SYSTEM':
          return tokens.colors.textMuted;
        case 'GUESS':
          return tokens.colors.textSecondary;
        default:
          return tokens.colors.textPrimary;
      }
    },
    [],
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Header with toggle */}
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <Button
          label={expanded ? '▲' : '▼'}
          onPress={onToggle}
          variant="ghost"
          style={styles.toggleButton}
          testID="toggle-chat-button"
        />
      </View>

      {expanded ? (
        <>
          {/* Message list */}
          <ScrollView
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
          >
            {messages.length === 0 ? (
              <Text style={styles.emptyText}>No messages yet</Text>
            ) : (
              messages.map((msg) => (
                <View key={msg.id} style={styles.messageRow}>
                  <Text
                    style={[
                      styles.messageTime,
                      { color: tokens.colors.textMuted },
                    ]}
                  >
                    {formatTime(msg.createdAt)}
                  </Text>
                  {msg.senderNickname ? (
                    <Text
                      style={[
                        styles.messageSender,
                        { color: tokens.colors.textSecondary },
                      ]}
                    >
                      {msg.senderNickname}:
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.messageText,
                      { color: messageColor(msg.messageType) },
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Input area */}
          <View style={styles.inputArea}>
            <Input
              value={input}
              onChangeText={(v) => {
                setInput(v);
                setError(null);
              }}
              placeholder="Type a message..."
              errorMessage={error}
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              testID="chat-input"
            />
            <Button
              label="Send"
              onPress={handleSend}
              variant="primary"
              disabled={input.trim().length === 0}
              testID="chat-send-button"
            />
          </View>
        </>
      ) : (
        <View style={styles.collapsedHint}>
          <Text style={styles.collapsedText}>Tap to expand chat</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderLight,
    maxHeight: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderLight,
  },
  title: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '700' as const,
    color: tokens.colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  toggleButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    minHeight: 28,
  },
  messageList: {
    flex: 1,
    maxHeight: 200,
  },
  messageListContent: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  emptyText: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: tokens.spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexWrap: 'wrap',
  },
  messageTime: {
    fontSize: 11,
  },
  messageSender: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600' as const,
  },
  messageText: {
    fontSize: tokens.typography.caption.fontSize,
    flex: 1,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  collapsedHint: {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  collapsedText: {
    fontSize: tokens.typography.caption.fontSize,
    color: tokens.colors.textMuted,
  },
});
