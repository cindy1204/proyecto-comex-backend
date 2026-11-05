import { app } from './interface/http/app.js';
import { config } from './infrastructure/config.js';
import { prisma } from './infrastructure/prisma-client.js';

const server = app.listen(config.port, () => {
  console.log(`API de ColComex disponible en http://localhost:${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`Cerrando API por ${signal}...`);
  server.close(async (error) => {
    if (error) {
      console.error('No se pudo cerrar el servidor HTTP correctamente:', error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
