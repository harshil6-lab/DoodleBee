/**
 * ErrorBoundary - catches unhandled React rendering errors and provides
 * a recovery UI instead of a permanent white screen.
 *
 * Wraps the navigation Stack in `_layout.tsx`. ConnectionBanner and other
 * root-level components stay OUTSIDE the boundary so they survive crashes.
 *
 * In DEV, the error is logged to console with stack trace for debugging.
 * In PRODUCTION, only a user-friendly message is shown.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { ComicSurface } from './ui/ComicSurface';
import { tokens } from '../theme/tokens';
import { Button } from './Button';
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log full details in dev; only user-friendly text reaches the UI.
    console.error('[ErrorBoundary] Caught:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReportBug = () => {
    Linking.openURL(
      'mailto:support@doodlebee.dev?subject=DoodleBee%20Crash&body=Environment:%20Production%0AError:%20' +
        encodeURIComponent(this.state.error?.message ?? 'unknown'),
    );
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.root} testID="error-boundary-fallback">
        <ComicSurface
          variant="comic"
          radius={tokens.radius.card}
          backgroundColor={tokens.colors.white}
          borderColor={tokens.colors.hotPink}
          style={styles.card}
          contentStyle={styles.cardInner}
        >
          <Text style={styles.title}>Oops! Something went wrong</Text>
          <Text style={styles.message}>
            The app ran into an unexpected error. You can try again or let us
            know about it.
          </Text>

          {/* DEV-only: show minimal error context */}
          {__DEV__ && this.state.error ? (
            <Text style={styles.devError} numberOfLines={3}>
              {this.state.error.message}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Button
              label="Try Again"
              onPress={this.handleRetry}
              variant="primary"
              testID="error-retry-button"
            />
            <Button
              label="Report Bug"
              onPress={this.handleReportBug}
              variant="ghost"
              testID="error-report-button"
            />
          </View>
        </ComicSurface>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
  cardInner: {
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
    alignItems: 'center',
  },
  title: {
    ...tokens.typography.heading,
    color: tokens.colors.ink,
    textAlign: 'center',
  },
  message: {
    ...tokens.typography.body,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  devError: {
    ...tokens.typography.caption,
    color: tokens.colors.hotPink,
    textAlign: 'left',
    width: '100%',
    marginTop: tokens.spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
    width: '100%',
  },
});
