import 'dotenv/config';
import { createApp } from './interface/app.js';
import { createContainer } from './interface/container.js';
import { loadConfig } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function main(): void {
  const config = loadConfig(process.env);
  const container = createContainer(config);
  const app = createApp(container, { corsOrigins: config.corsOrigins });

  const server = app.listen(config.port, () => {
    logger.info(`API escuchando en el puerto ${config.port}.`);
  });

  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    logger.info(`Señal ${signal} recibida: cerrando el servidor.`);
    server.close(() => {
      container.shutdown().then(
        () => process.exit(0),
        (error: unknown) => {
          logger.error('No se pudo cerrar la conexión con la base de datos.', error);
          process.exit(1);
        },
      );
    });
  };
  for (const signal of SHUTDOWN_SIGNALS) process.on(signal, () => shutdown(signal));
}

try {
  main();
} catch (error) {
  logger.error('No se pudo iniciar la API.', error);
  process.exit(1);
}
