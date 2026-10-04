/**
 * BeeMascot - the approved DoodleBee character.
 *
 * The artwork is the exact `BeeMascot` SVG from the approved Figma Make
 * project (viewBox 0 0 180 215), rasterized from `assets/mascot/bee.svg` at
 * 3x. It must not be redrawn or restyled.
 */
import { Image, type StyleProp, type ImageStyle } from 'react-native';

export interface BeeMascotProps {
  /** Rendered width; height follows the 180:215 aspect ratio. */
  size?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}

export const BEE_ASPECT = 215 / 180;

export function BeeMascot({ size = 120, style, testID }: BeeMascotProps) {
  return (
    <Image
      source={require('../../../assets/mascot/bee.png')}
      style={[{ width: size, height: Math.round(size * BEE_ASPECT) }, style]}
      resizeMode="contain"
      accessible
      accessibilityLabel="DoodleBee mascot"
      testID={testID}
    />
  );
}
