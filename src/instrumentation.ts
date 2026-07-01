/**
 * Next.js instrumentation — runs once when the server starts.
 *
 * Starts the Xiangqi socket.io game server (port 3003) inside the Next.js
 * process so it stays alive for the whole dev session. Background processes
 * started from the shell don't survive between commands in this sandbox, but
 * the Next.js dev server does — so we attach the game server to it.
 *
 * The server still listens on its own port (3003) and is reached through the
 * Caddy gateway via `XTransformPort=3003`, exactly as the frontend expects.
 *
 * `startGameService` is idempotent (singleton guard), so hot reloads are safe.
 */
export async function register() {
  // Only run in the Node.js runtime (not edge, not during build).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startGameService } = await import('./lib/gameServer');
  startGameService(3003);
}
