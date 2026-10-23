import PgBoss from 'pg-boss';
import { pool } from '../src/db';
import { env } from '../src/lib/env';
import { registerPackageSyncJob } from '../src/server/jobs/package-sync';

async function main() {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
  });

  boss.on('error', (error) => {
    console.error('pg-boss error:', error);
  });

  await boss.start();
  await registerPackageSyncJob(boss);
  console.info('Holbo worker started');

  let stopping = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.info(`Received ${signal}; stopping worker`);
    try {
      await boss.stop();
    } catch (error) {
      console.error('Failed to stop pg-boss cleanly:', error);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('Failed to start Holbo worker:', error);
  process.exitCode = 1;
});
