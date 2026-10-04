/**
 * PaperBackground - the approved `.paper-dots` backdrop.
 *
 * Cream base with a 22px dot grid drawn on a Skia canvas clipped to the
 * screen. Non-interactive; place as the first child of a screen container.
 */
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { tokens } from '../../theme/tokens';

export function PaperBackground() {
  const { width, height } = useWindowDimensions();
  const { spacing, dotRadius } = tokens.paperDots;

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    for (let x = spacing / 2; x < width + spacing; x += spacing) {
      for (let y = spacing / 2; y < height + spacing; y += spacing) {
        p.addCircle(x, y, dotRadius);
      }
    }
    return p;
  }, [width, height, spacing, dotRadius]);

  return (
    <View style={styles.root} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={path} color={tokens.colors.ink} opacity={0.12} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.colors.cream,
  },
});
