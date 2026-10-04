/**
 * DrawingToolbar — drawer-only controls: colour, brush size, clear, hint.
 *
 * Colours and sizes follow `src/drawing/config.ts` defaults.
 * Hint button only enabled when `hintsRemaining > 0`.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { useDrawerGameStore } from '../stores/drawer.store';
import { useUiStore } from '../stores/ui.store';
import { emitWithoutAck } from '../realtime/socket';
import { ClientToServerEvent } from '../types';

// ---------------------------------------------------------------- Constants ---

const COLORS = [
  '#000000',
  '#EF476F',
  '#FFD166',
  '#06D6A0',
  '#118AB2',
  '#7B2CBF',
  '#FF6B9D',
  '#FFFFFF',
] as const;
const SIZES = [4, 8, 12, 16, 20] as const;

// ---------------------------------------------------------------- Component --

export function DrawingToolbar() {
  const selectedColor = useDrawerGameStore((s) => s.selectedColor);
  const brushSize = useDrawerGameStore((s) => s.brushSize);
  const setSelectedColor = useDrawerGameStore((s) => s.setSelectedColor);
  const setBrushSize = useDrawerGameStore((s) => s.setBrushSize);
  const hintsRemaining = useDrawerGameStore((s) => s.hintsRemaining);
  const phase = useDrawerGameStore((s) => s.phase);
  const openModal = useUiStore((s) => s.openModal);

  const handleClear = () => {
    if (phase !== 'ROUND_ACTIVE') return;
    openModal('clearCanvas');
  };

  const handleHint = () => {
    if (phase !== 'ROUND_ACTIVE' || hintsRemaining <= 0) return;
    emitWithoutAck(ClientToServerEvent.UseHint, {});
  };

  return (
    <View style={styles.container} testID="drawing-toolbar">
      {/* Colour palette */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.colorRow}
      >
        {COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => setSelectedColor(color)}
            style={[styles.colorSwatch, { backgroundColor: color }]}
            testID={`color-${color.replace('#', '')}`}
          >
            {selectedColor === color ? (
              <View style={styles.colorSelectedRing}>
                <View style={styles.colorSelectedInner} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      {/* Brush sizes */}
      <View style={styles.sizeRow}>
        {SIZES.map((size) => (
          <Pressable
            key={size}
            onPress={() => setBrushSize(size)}
            style={[
              styles.sizeButton,
              brushSize === size && styles.sizeButtonActive,
            ]}
            testID={`brush-size-${size}`}
          >
            <View
              style={[
                styles.sizeDot,
                { width: size, height: size, backgroundColor: selectedColor },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleClear}
          disabled={phase !== 'ROUND_ACTIVE'}
          style={[
            styles.actionButton,
            phase !== 'ROUND_ACTIVE' && styles.actionDisabled,
          ]}
          testID="clear-canvas-toolbar-button"
        >
          <Text style={styles.actionButtonText}>Clear</Text>
        </Pressable>
        <Pressable
          onPress={handleHint}
          disabled={phase !== 'ROUND_ACTIVE' || hintsRemaining <= 0}
          style={[
            styles.actionButton,
            (phase !== 'ROUND_ACTIVE' || hintsRemaining <= 0) &&
              styles.actionDisabled,
          ]}
          testID="hint-button"
        >
          <Text style={styles.actionButtonText}>
            {hintsRemaining > 0 ? `Hint (${hintsRemaining})` : 'No Hints'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderLight,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  colorRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.colors.borderLight,
  },
  colorSelectedRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelectedInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.primary,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderLight,
    backgroundColor: tokens.colors.background,
  },
  sizeButtonActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: `${tokens.colors.primary}11`,
  },
  sizeDot: {
    borderRadius: 9999,
    backgroundColor: '#000000',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderLight,
    alignItems: 'center',
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600' as const,
    color: tokens.colors.textPrimary,
  },
});
