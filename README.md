# API de ColComex (backend)

API REST de comercio exterior hecha con Node.js, Express 5, TypeScript, Prisma 6 y PostgreSQL. Expone el catálogo de numerales cambiarios, las interacciones (formularios de importación y exportación) y las solicitudes de contacto, con autenticación JWT y roles `ADMIN` y `USER`. El frontend vive en otro repositorio ([proyecto-comex-frontend](https://github.com/cindy1204/proyecto-comex-frontend)) y consume esta API.

## Enlaces del proyecto

| Recurso                           | Enlace                    |
| --------------------------------- | ------------------------- |
| Repositorio del backend           | `https://...` (COMPLETAR) |
| Repositorio del frontend          | `https://...` (COMPLETAR) |
| Backend desplegado (API)          | `https://...` (COMPLETAR) |
| Frontend desplegado               | `https://...` (COMPLETAR) |
| Base de datos / proyecto Supabase | `https://...` (COMPLETAR) |
| Video o presentación (opcional)   | `https://...` (COMPLETAR) |

## Reparto del trabajo

| Integrante           | Responsabilidad                                     |
| -------------------- | --------------------------------------------------- |
| COMPLETAR (nombre 1) | COMPLETAR (por ejemplo, autenticación y roles)      |
| COMPLETAR (nombre 2) | COMPLETAR (por ejemplo, catálogo e imágenes)        |
| COMPLETAR (nombre 3) | COMPLETAR (por ejemplo, interacciones y contacto)   |
| COMPLETAR (nombre 4) | COMPLETAR (por ejemplo, pruebas, lint y despliegue) |

## Arquitectura

Arquitectura limpia en cuatro capas; las dependencias apuntan hacia el dominio y todo se ensambla en un único punto (`src/interface/container.ts`).

```
src/
  domain/          modelos, contratos de repositorio (I*.repository) y de servicios (hash, token, archivos)
  application/     casos de uso, errores de aplicación, paginación y mappers a la forma pública
  infrastructure/  DTOs (Zod), repositorios Prisma, bcrypt, JWT, Supabase Storage, configuración, logger
  interface/       controladores, routers Express, middlewares, app y contenedor de dependencias
  server.ts        arranque y apagado ordenado
prisma/            schema, migraciones y seed (datos en prisma/data)
tests/             unit/ (casos de uso y middlewares) y http/ (supertest sobre la app completa)
```

Los controladores no tocan Prisma: llaman a casos de uso, que dependen solo de las interfaces del dominio. Los tests inyectan repositorios en memoria, por lo que no requieren base de datos.

Los borrados de catálogo, interacciones y solicitudes son lógicos (`state` = `REMOVED` y `deletedAt`). Los montos usan `Decimal(14,2)` en la base y viajan como cadena (`"1500.50"`) para no perder precisión.

**Imágenes:** el almacenamiento S3 del proyecto es **Supabase Storage** (su API de objetos es compatible con S3). La imagen se envía en el mismo `POST`/`PUT` del catálogo, como `multipart/form-data` con el campo `image` (JPG, PNG o WebP, máximo 5 MB); el backend la sube al bucket y guarda la URL pública en `imageUrl`. No existe un endpoint de subida aparte y el cliente no puede enviar `imageUrl`.

## Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL (local o administrado). Opcional: un proyecto de Supabase para las imágenes.

## Instalación y ejecución

```bash
npm install
cp .env.example .env        # completa DATABASE_URL, JWT_SECRET y JWT_EXPIRES_IN
npm run prisma:deploy       # aplica las migraciones
npm run db:seed             # catálogo y cuentas de demostración (idempotente)
npm run dev                 # http://localhost:3001  (verifica GET /health)
```

Para producción: `npm run build` y luego `npm start`.

## Variables de entorno

Detalladas y comentadas en `.env.example`. La API no arranca si falta alguna obligatoria.

| Variable                                    | Obligatoria | Descripción                                                       |
| ------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                              | Sí          | Conexión PostgreSQL de Prisma                                     |
| `JWT_SECRET`                                | Sí          | Secreto de firma, mínimo 32 caracteres, sin valor por defecto     |
| `JWT_EXPIRES_IN`                            | Sí          | Vigencia del token en segundos                                    |
| `PORT`                                      | No          | Puerto HTTP (3001)                                                |
| `CORS_ORIGINS`                              | No          | Orígenes permitidos separados por comas; otros reciben 403        |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | No          | Habilitan la subida de imágenes; sin ellas la subida responde 503 |
| `SUPABASE_STORAGE_BUCKET`                   | No          | Bucket público de imágenes (`catalogo`)                           |
| `SEED_ADMIN_*`, `SEED_USER_*`               | No          | `NAME`, `EMAIL` y `PASSWORD` de las cuentas del seed              |

## Credenciales de prueba (seed)

El seed siempre crea un administrador y un usuario, y se puede repetir sin duplicar datos:

| Rol   | Correo                 | Contraseña     |
| ----- | ---------------------- | -------------- |
| ADMIN | `admin@colcomex.com`   | `Admin#2026`   |
| USER  | `usuario@colcomex.com` | `Usuario#2026` |

Son cuentas de demostración: en cualquier entorno compartido o público define `SEED_*` con valores propios. Si el correo ya existe, el seed no cambia su contraseña ni su rol. El seed también carga los numerales de `prisma/data/catalogo.json` y los de servicios de `prisma/data/servicios.json` (transcritos del Anexo 3 del DCIP-83, actualizado al 1 de septiembre de 2021; confirma su vigencia antes de usarlos en una operación real).

## Endpoints

Todas las rutas están bajo `/api`, salvo `/health`. Los errores tienen la forma `{ "error": { "code", "message", "details"? } }` y los listados `{ "data": [...], "pagination": { "total", "currentPage", "limit", "totalPages" } }` (`page` por defecto 1; `limit` por defecto 10, máximo 50; valores inválidos responden 400). Los ids son `cuid`; un id inválido responde 400. Autenticación: `Authorization: Bearer <token>`.

| Método | Ruta                             | Acceso                                                                                                                       |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                        | Público; `{ "status": "ok" }`                                                                                                |
| POST   | `/api/auth/register`             | Público; 201 con `{ user, token, expiresIn }`; correo repetido 409                                                           |
| POST   | `/api/auth/login`                | Público; 200, o 401 "Credenciales inválidas."                                                                                |
| GET    | `/api/auth/me`                   | Autenticado                                                                                                                  |
| POST   | `/api/auth/admins`               | Solo admin; crea otro administrador                                                                                          |
| GET    | `/api/catalogos`                 | Público; filtros `category`, `direction`, `search`, `createdFrom`, `createdTo`; `state=ACTIVE\|REMOVED\|ALL` solo para admin |
| GET    | `/api/catalogos/:id`             | Público (los eliminados solo los ve un admin)                                                                                |
| POST   | `/api/catalogos`                 | Solo admin; JSON o `multipart/form-data` con `image`; duplicado 409                                                          |
| PUT    | `/api/catalogos/:id`             | Solo admin; JSON o multipart; `state: "ACTIVE"` restaura un numeral eliminado                                                |
| DELETE | `/api/catalogos/:id`             | Solo admin; borrado lógico 204 (si ya estaba eliminado, 404)                                                                 |
| POST   | `/api/interacciones`             | Autenticado                                                                                                                  |
| GET    | `/api/interacciones`             | Solo admin; filtros `type`, `userId`, fechas                                                                                 |
| GET    | `/api/interacciones/mias`        | Autenticado; solo las propias                                                                                                |
| GET    | `/api/interacciones/:id`         | Propietario o admin (ajeno: 404)                                                                                             |
| PUT    | `/api/interacciones/:id`         | Propietario o admin                                                                                                          |
| DELETE | `/api/interacciones/:id`         | Propietario o admin; borrado lógico 204                                                                                      |
| POST   | `/api/solicitudes-contacto`      | Público; con token válido queda asociada a la cuenta, con token inválido 401                                                 |
| GET    | `/api/solicitudes-contacto`      | Solo admin; filtros `tipoProducto`, `search`, fechas                                                                         |
| GET    | `/api/solicitudes-contacto/mias` | Autenticado; solo las propias                                                                                                |
| GET    | `/api/solicitudes-contacto/:id`  | Propietario o admin                                                                                                          |
| PUT    | `/api/solicitudes-contacto/:id`  | Propietario o admin                                                                                                          |
| DELETE | `/api/solicitudes-contacto/:id`  | Propietario o admin; borrado lógico 204                                                                                      |

Códigos: 400 validación o JSON/ruta mal formados, 401 sin token o token inválido (incluido el de un usuario eliminado), 403 sin permiso u origen CORS no permitido, 404 no existe o es ajeno, 409 duplicado o referencia en conflicto, 413 cuerpo mayor a 1 MB o imagen mayor a 5 MB, 415 imagen que no es JPG/PNG/WebP, 429 límite de peticiones, 502/503 fallo o falta de configuración del almacenamiento de imágenes. Ningún error expone trazas.

Límites de peticiones (por proceso): 300 por 15 minutos en `/api`, 20 en autenticación, 10 en contacto y 60 por usuario en cargas de imagen.

## Cómo probar

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint + typescript-eslint
npm run format:check  # Prettier
npm test            # Vitest + supertest
npm run build
```

Las pruebas usan repositorios en memoria, así que no necesitan PostgreSQL ni Supabase. Cubren los casos de uso, los middlewares y los flujos HTTP completos (roles, borrado lógico, paginación, subida de imágenes con un almacenamiento simulado, límite de tamaño, JSON inválido, `%` en la ruta y CORS).

## Despliegue

Configura como variables del servicio `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` y `CORS_ORIGINS` (con el dominio del frontend desplegado), más las de Supabase si habilitas imágenes. Ejecuta `npm run build`, aplica migraciones con `npm run prisma:deploy`, carga datos con `npm run db:seed` (con `SEED_*` propios) e inicia con `npm start`. No guardes secretos en GitHub.

## Uso de inteligencia artificial

Se usó un asistente de IA (Claude) para reestructurar el código en capas, implementar el contrato, escribir las pruebas y redactar este README. Se probó contra una base PostgreSQL real con curl y con la suite de pruebas. El equipo debe revisar el código y ser capaz de explicarlo; las subidas reales a Supabase Storage no se probaron con credenciales reales.
