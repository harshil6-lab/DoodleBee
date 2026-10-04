/**
 * DrawingToolbar - drawer-only controls: colour, brush size, clear, hint.
 *
 * Colours and sizes follow `src/drawing/config.ts` defaults.
 * Hint button only enabled when `hintsRemaining > 0`.
 *
 * NOTE (Phase 5): the approved Figma Make mock shows additional tool modes
 * (brush / eraser / size / more sheets). Those are not part of the approved
 * drawing contract, so only the existing controls are restyled into the
 * Figma visual language - no new tools are introduced.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
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

/** Brush-size labels mirroring the approved size sheet (XS S M L XL). */
const SIZE_LABELS: Record<number, string> = {
  4: 'XS',
  8: 'S',
  12: 'M',
  16: 'L',
  20: 'XL',
};

// ---------------------------------------------------------------- Component --

export function DrawingToolbar() {
  const selectedColor = useDrawerGameStore((s) => s.selectedColor);
  const brushSize = useDrawerGameStore((s) => s.brushSize);
  const setSelectedColor = useDrawerGameStore((s) => s.setSelectedColor);
  const setBrushSize = useDrawerGameStore((s) => s.setBrushSize);
  const hintsRemaining = useDrawerGameStore((s) => s.hintsRemaining);
  const phase = useDrawerGameStore((s) => s.phase);
  const openModal = useUiStore((s) => s.openModal);
  const [pressed, setPressed] = useState<string | null>(null);

  const handleClear = () => {
    if (phase !== 'ROUND_ACTIVE') return;
    openModal('clearCanvas');
  };

  const handleHint = () => {
    if (phase !== 'ROUND_ACTIVE' || hintsRemaining <= 0) return;
    emitWithoutAck(ClientToServerEvent.UseHint, {});
  };

  const toolsDisabled = phase !== 'ROUND_ACTIVE';

  return (
    <View style={styles.container} testID="drawing-toolbar">
      <Text style={styles.sectionLabel}>🎨 COLOUR</Text>

      {/* Colour palette */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorRow}
      >
        {COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => setSelectedColor(color)}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              selectedColor === color && styles.colorSwatchActive,
            ]}
            testID={`color-${color.replace('#', '')}`}
          >
            {selectedColor === color ? (
              <View style={styles.colorSelectedRing} />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>〰️ BRUSH SIZE</Text>

      {/* Brush sizes */}
      <View style={styles.sizeRow}>
        {SIZES.map((size) => (
          <Pressable
            key={size}
            onPress={() => setBrushSize(size)}
            style={styles.sizeButton}
            testID={`brush-size-${size}`}
          >
            <ComicSurface
              variant="sticker"
              radius={tokens.radius.sm}
              backgroundColor={
                brushSize === size
                  ? tokens.colors.beeYellow
                  : tokens.colors.white
              }
              offset={2}
              contentStyle={styles.sizeFace}
            >
              <Text style={styles.sizeLabel}>{SIZE_LABELS[size]}</Text>
              <View
                style={[
                  styles.sizeDot,
                  { width: size, height: size, backgroundColor: selectedColor },
                ]}
              />
            </ComicSurface>
          </Pressable>
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleClear}
          onPressIn={() => setPressed('clear')}
          onPressOut={() => setPressed(null)}
          disabled={toolsDisabled}
          style={styles.actionSlot}
          testID="clear-canvas-toolbar-button"
        >
          <ComicSurface
            variant="comic"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.hotPink}
            offset={
              pressed === 'clear' ? tokens.hardShadow.comicActive : undefined
            }
            contentStyle={[
              styles.actionFace,
              {
                transform: [
                  { translateX: pressed === 'clear' ? 4 : 0 },
                  { translateY: pressed === 'clear' ? 4 : 0 },
                ],
              },
              toolsDisabled && styles.actionDisabled,
            ]}
          >
            <Text style={styles.actionTextLight}>🗑️ CLEAR</Text>
          </ComicSurface>
        </Pressable>

        <Pressable
          onPress={handleHint}
          onPressIn={() => setPressed('hint')}
          onPressOut={() => setPressed(null)}
          disabled={toolsDisabled || hintsRemaining <= 0}
          style={styles.actionSlot}
          testID="hint-button"
        >
          <ComicSurface
            variant="comic"
            radius={tokens.radius.sm}
            backgroundColor={tokens.colors.beeYellow}
            offset={
              pressed === 'hint' ? tokens.hardShadow.comicActive : undefined
            }
            contentStyle={[
              styles.actionFace,
              {
                transform: [
                  { translateX: pressed === 'hint' ? 4 : 0 },
                  { translateY: pressed === 'hint' ? 4 : 0 },
                ],
              },
              (toolsDisabled || hintsRemaining <= 0) && styles.actionDisabled,
            ]}
          >
            <Text style={styles.actionTextDark}>
              {hintsRemaining > 0
                ? `💡 HINT (${hintsRemaining})`
                : '💡 NO HINTS'}
            </Text>
          </ComicSurface>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Styles ---

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.cream,
    borderTopWidth: tokens.border.comic,
    borderTopColor: tokens.colors.ink,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  sectionLabel: {
    ...tokens.typography.label,
    color: tokens.colors.muted,
  },
  colorRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingVertical: 2,
    paddingRight: tokens.spacing.sm,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.border.sticker,
    borderColor: tokens.colors.ink,
  },
  colorSwatchActive: {
    borderWidth: tokens.border.comic,
    borderColor: tokens.colors.purple,
  },
  colorSelectedRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.beeYellow,
    borderWidth: 2,
    borderColor: tokens.colors.ink,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  sizeButton: {
    flex: 1,
  },
  sizeFace: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sizeLabel: {
    ...tokens.typography.label,
    color: tokens.colors.ink,
  },
  sizeDot: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: tokens.colors.ink,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  actionSlot: {
    flex: 1,
  },
  actionFace: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.sm,
  },
  actionTextLight: {
    ...tokens.typography.button,
    fontSize: 16,
    color: tokens.colors.cream,
  },
  actionTextDark: {
    ...tokens.typography.button,
    fontSize: 16,
    color: tokens.colors.ink,
  },
  actionDisabled: {
    opacity: 0.45,
  },
});
