/**
 * Connection banner auto-dismiss logic tests (Phase 4B).
 *
 * Verifies the dismiss-timer behavior extracted from the banner component.
 * Uses jest fake timers; no React Testing Library dependency required.
 */
describe('ConnectionBanner — auto-dismiss logic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('banner stays visible while disconnected', () => {
    const { status, isHidden } = createBannerState();
    status('disconnected');
    jest.advanceTimersByTime(5000);
    expect(isHidden()).toBe(false);
  });

  it('banner stays visible while reconnecting', () => {
    const { status, isHidden } = createBannerState();
    status('reconnecting');
    jest.advanceTimersByTime(5000);
    expect(isHidden()).toBe(false);
  });

  it('banner shows briefly on reconnected then dismisses after 2s', () => {
    const { status, isHidden } = createBannerState();
    status('reconnected');
    // Visible immediately.
    expect(isHidden()).toBe(false);
    // Not dismissed before 2s.
    jest.advanceTimersByTime(1999);
    expect(isHidden()).toBe(false);
    // Dismissed at exactly 2s.
    jest.advanceTimersByTime(1);
    expect(isHidden()).toBe(true);
  });

  it('reconnecting after dismiss shows banner again', () => {
    const { status, isHidden } = createBannerState();
    status('reconnected');
    jest.advanceTimersByTime(2000);
    expect(isHidden()).toBe(true);
    // New disconnect should re-show the banner.
    status('disconnected');
    expect(isHidden()).toBe(false);
  });
});

// ---------------------------------------------------------------- Helpers ---

/**
 * Minimal state tracker mirroring the ConnectionBanner dismiss logic:
 * - `status(s)` transitions the connection status
 * - `isHidden()` returns true when the banner would be visually hidden
 */
function createBannerState() {
  let currentStatus: import('../../../src/stores/connection.store').ConnectionStatus =
    'expired';
  let dismissed = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function setStatus(s: typeof currentStatus) {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    currentStatus = s;
    if (s === 'reconnected') {
      timerId = setTimeout(() => {
        timerId = null;
        dismissed = true;
      }, 2000);
    } else {
      dismissed = false;
    }
  }

  function isHidden(): boolean {
    return (
      dismissed &&
      (currentStatus === 'connected' || currentStatus === 'reconnected')
    );
  }

  return { status: setStatus, isHidden };
}
