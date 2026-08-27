import { createApp } from './app.js';
import { getEnv } from './config/env.js';

/**
 * Boot. `getEnv()` throws if anything required is missing, so a misconfigured
 * server refuses to start rather than failing on the first farmer's request.
 */
function main(): void {
  let env;

  try {
    env = getEnv();
  } catch (error) {
    console.error((error as Error).message);
    console.error('\nCopy backend/.env.example to backend/.env and fill it in.');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.info(`KrishiNetra API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => () => {
    console.info(`\n${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

main();
