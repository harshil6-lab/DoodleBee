/**
 * Environment configuration (ADR section 20.4).
 *
 * `EXPO_PUBLIC_*` variables are inlined into the client bundle by Expo, so
 * they must never hold secrets. Local values belong in `.env.local`
 * (git-ignored); see `.env.example`.
 */
export const env = {
  /** Base URL for REST endpoints (ADR section 10). Empty until configured. */
  get apiUrl(): string {
    return process.env.EXPO_PUBLIC_API_URL ?? '';
  },

  /** Base URL for the Socket.IO server (ADR section 11). */
  get socketUrl(): string {
    return process.env.EXPO_PUBLIC_SOCKET_URL ?? '';
  },

  get isDev(): boolean {
    return __DEV__;
  },

  /** True when a REST base URL has been configured for this environment. */
  get isApiConfigured(): boolean {
    return this.apiUrl.length > 0;
  },

  /** True when a realtime server URL has been configured for this environment. */
  get isSocketConfigured(): boolean {
    return this.socketUrl.length > 0;
  },
};
