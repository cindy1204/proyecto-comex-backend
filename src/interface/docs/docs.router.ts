import { readFileSync } from 'node:fs';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

/** Contrato público de la API. Vive en docs/ para que se pueda leer sin ejecutar el servidor. */
const OPENAPI_PATH = new URL('../../../docs/openapi.yaml', import.meta.url);
const OPENAPI_SOURCE = readFileSync(OPENAPI_PATH, 'utf8');
const openApiDocument = parse(OPENAPI_SOURCE) as swaggerUi.JsonObject;

/**
 * Swagger UI en `/api/docs/` y el YAML crudo en `/api/docs/openapi.yaml`.
 * Se monta antes de helmet y CORS: la interfaz necesita scripts en línea que la política de
 * contenido de helmet bloquearía. Por eso tampoco pasa por el limitador de `/api`.
 */
export function createDocsRouter(): Router {
  const router = Router();

  router.get('/openapi.yaml', (_request, response) => {
    response.type('application/yaml').send(OPENAPI_SOURCE);
  });

  // Sin barra final, las rutas relativas de Swagger UI apuntarían a /api/. Se redirige a /api/docs/.
  router.get('/', (request, response, next) => {
    if (!request.originalUrl.split('?')[0]?.endsWith('/')) {
      response.redirect(301, `${request.originalUrl.split('?')[0]}/`);
      return;
    }
    next();
  });

  router.use('/', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'ColComex API' }));
  return router;
}
