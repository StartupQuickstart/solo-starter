/**
 * Database seed script for @app/api.
 *
 * This is a placeholder: users arrive through Clerk (the first signed-in
 * request and the webhook), and each user writes their own notes.
 * Run via: pnpm --filter @app/api db:seed
 */
async function main(): Promise<void> {
  console.log('[seed] No seed data defined yet (placeholder only).');
}

main().catch((error) => {
  console.error('[seed] Fatal error:', error);
  process.exit(1);
});
