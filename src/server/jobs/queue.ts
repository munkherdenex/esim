import PgBoss from 'pg-boss';
import { env } from '@/lib/env';

let bossPromise: Promise<PgBoss> | undefined;

export async function enqueueJob(
  name: string,
  data: Record<string, unknown>,
  options?: PgBoss.SendOptions,
): Promise<string | null> {
  bossPromise ??= startBoss();
  const boss = await bossPromise;
  return options ? boss.send(name, data, options) : boss.send(name, data);
}

async function startBoss(): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on('error', (error) => {
    console.error('Web pg-boss client error:', error);
  });
  await boss.start();
  return boss;
}
