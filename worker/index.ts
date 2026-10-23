import PgBoss from 'pg-boss';
import { env } from '../src/lib/env';

async function main() {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
  });

  boss.on('error', (error) => {
    console.error('pg-boss error:', error);
  });

  await boss.start();
  console.info('Holbo worker started');

  let stopping = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.info(`Received ${signal}; stopping worker`);
    await boss.stop();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('Failed to start Holbo worker:', error);
  process.exitCode = 1;
});
