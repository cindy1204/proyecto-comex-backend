import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../support/http-app.js';

describe('documentación de la API', () => {
  const { app } = createTestApp();

  it('sirve el contrato OpenAPI en YAML', async () => {
    const response = await request(app).get('/api/docs/openapi.yaml');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/yaml');
    expect(response.text).toContain('openapi: 3.1.0');
  });

  it('redirige /api/docs a /api/docs/ para que Swagger UI cargue sus recursos', async () => {
    const response = await request(app).get('/api/docs');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('/api/docs/');
  });

  it('sirve Swagger UI con el título de la API', async () => {
    const response = await request(app).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('ColComex API');
  });
});
