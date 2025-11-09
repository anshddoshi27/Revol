export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Consumers should provide an implementation that returns the current auth token
export type TokenProvider = () => string | null;

let tokenProvider: TokenProvider = () => null;

export const setTokenProvider = (provider: TokenProvider) => {
	tokenProvider = provider;
};

export const getToken = (): string | null => tokenProvider();

export const DEFAULT_RATE_LIMIT_BACKOFF_MS = 1000; // initial backoff for 429
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

