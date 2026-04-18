/**
 * Port interfaces defined in packages/core so each project can supply
 * its own implementation. No logger or transport implementation lives here.
 */

// ─── Logger ──────────────────────────────────────────────────────────────────

export interface Logger {
  /** Debug — high-frequency, disabled in production */
  d(message: string, ...args: unknown[]): void;
  /** Info — significant lifecycle events */
  i(message: string, ...args: unknown[]): void;
  /** Warning — unexpected but recoverable */
  w(message: string, ...args: unknown[]): void;
  /** Error — requires attention */
  e(message: string | Error, ...args: unknown[]): void;
  /** Structured log with explicit level and metadata */
  log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>,
  ): void;
}

// ─── Transport ───────────────────────────────────────────────────────────────

export interface Transport {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
  onMessage: ((data: string) => void) | null;
  onClose: ((code: number, reason: string) => void) | null;
  onError: ((error: Error) => void) | null;
}
