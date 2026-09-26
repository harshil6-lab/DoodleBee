import { Redirect } from 'expo-router';

/**
 * Route: /
 * Home - placeholder. The approved Home screen (branding, nickname display,
 * create/join entry points) belongs to the UI stage; screens are intentionally
 * not implemented in Stage 02.
 */
export default function IndexScreen() {
  return <Redirect href="/nickname" />;
}
