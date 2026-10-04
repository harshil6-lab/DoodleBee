/**
 * Font asset map. The approved design uses Paytone One (display) and Nunito
 * (body), both served from Google Fonts by the Figma Make project. The
 * matching TTFs are vendored under `assets/fonts` so the app renders the
 * approved type without a network round-trip.
 */
export const fontAssets = {
  PaytoneOne_400Regular: require('../../assets/fonts/PaytoneOne-Regular.ttf'),
  Nunito_400Regular: require('../../assets/fonts/Nunito-Regular.ttf'),
  Nunito_600SemiBold: require('../../assets/fonts/Nunito-SemiBold.ttf'),
  Nunito_700Bold: require('../../assets/fonts/Nunito-Bold.ttf'),
  Nunito_800ExtraBold: require('../../assets/fonts/Nunito-ExtraBold.ttf'),
} as const;
