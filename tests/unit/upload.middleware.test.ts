import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/interface/middlewares/error.handler.js';
import { getUploadedImage, uploadImage } from '../../src/interface/middlewares/upload.middleware.js';

function app() {
  const server = express();
  server.use(express.json());
  server.post('/upload', uploadImage, (req, res) => {
    const image = getUploadedImage(req);
    res.json({
      body: req.body ?? null,
      image: image ? { mimeType: image.mimeType, size: image.size, name: image.originalName } : null,
    });
  });
  server.use(errorHandler);
  return server;
}

describe('uploadImage', () => {
  it('deja pasar un JSON sin archivo', async () => {
    const response = await request(app()).post('/upload').send({ title: 'x' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ body: { title: 'x' }, image: null });
  });

  it('lee campos de texto y el archivo `image` en memoria', async () => {
    const response = await request(app())
      .post('/upload')
      .field('title', 'x')
      .attach('image', Buffer.from([1, 2, 3]), { filename: 'a.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.body).toEqual({ title: 'x' });
    expect(response.body.image).toEqual({ mimeType: 'image/png', size: 3, name: 'a.png' });
  });

  it('responde 413 si el archivo supera 5 MB', async () => {
    const response = await request(app())
      .post('/upload')
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 10), { filename: 'a.png', contentType: 'image/png' });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('responde 400 si el archivo llega en un campo distinto de `image`', async () => {
    const response = await request(app())
      .post('/upload')
      .attach('imageUrl', Buffer.from([1]), { filename: 'a.png', contentType: 'image/png' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_UPLOAD');
  });

  it('responde 400 si se envían dos archivos', async () => {
    const response = await request(app())
      .post('/upload')
      .attach('image', Buffer.from([1]), { filename: 'a.png', contentType: 'image/png' })
      .attach('image', Buffer.from([2]), { filename: 'b.png', contentType: 'image/png' });

    expect(response.status).toBe(400);
  });

  it('responde 400 si hay más de 10 campos de texto', async () => {
    let upload = request(app()).post('/upload');
    for (let index = 0; index < 11; index += 1) upload = upload.field(`campo${index}`, 'x');

    const response = await upload;

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_UPLOAD');
  });

  it('responde 400 si un campo de texto supera el tamaño permitido', async () => {
    const response = await request(app()).post('/upload').field('description', 'a'.repeat(40_001));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_UPLOAD');
  });

  it('acepta un campo de texto en el límite de tamaño y hasta 10 campos', async () => {
    let upload = request(app()).post('/upload').field('description', 'a'.repeat(40_000));
    for (let index = 0; index < 9; index += 1) upload = upload.field(`campo${index}`, 'x');

    const response = await upload;

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.body)).toHaveLength(10);
  });
});
