// Ambient declarations for optional integrations.
// These packages are loaded dynamically at runtime only when configured;
// declaring them here keeps the API typecheck clean without hard dependencies.
declare module '@sentry/node' {
  export function captureException(err: unknown, options?: Record<string, unknown>): void;
}
