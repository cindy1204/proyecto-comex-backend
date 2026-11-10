# API de ColComex

API REST de Node.js, Express, TypeScript, Prisma y PostgreSQL. Este repositorio contiene el backend independiente de la aplicación; el frontend se publica en [proyecto-comex-frontend](https://github.com/cindy1204/proyecto-comex-frontend).

## Arquitectura

El backend separa responsabilidades en cuatro capas:

- `src/domain`: entidades, contratos de repositorio, roles y errores de aplicación.
- `src/application`: casos de uso para autenticación, catálogo, interacciones y solicitudes de contacto.
- `src/infrastructure`: adaptadores de Prisma/PostgreSQL, bcrypt, JWT y configuración.
- `src/interface/http`: composición de dependencias, rutas Express, validación de entrada, autenticación y respuestas HTTP.

Las rutas no acceden directamente a Prisma: invocan servicios de aplicación que usan los contratos del dominio.

## Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL local o una base PostgreSQL administrada.

## Configuración local

1. Crea una base de datos PostgreSQL llamada `proyecto_comex` (por ejemplo, en pgAdmin: **Databases → Create → Database**).
2. Desde este directorio, instala dependencias:

   ```powershell
   npm install
   ```

3. Copia `.env.example` a `.env` y configura `DATABASE_URL` con tu usuario, contraseña y base. Reemplaza `JWT_SECRET` por un secreto aleatorio de al menos 32 caracteres. No compartas ni subas `.env`.
4. Genera el cliente, aplica las migraciones incluidas y carga el catálogo:

   ```powershell
   npm run prisma:generate
   npm run prisma:deploy
   npm run db:seed
   ```

   El seed carga los numerales de `prisma/data/catalogo.json` y los de servicios, transferencias y otros conceptos de `prisma/data/servicios.json`. La segunda lista se transcribió del Anexo 3 del DCIP-83 aportado, actualizado al 1 de septiembre de 2021; confirma la vigencia normativa antes de usarla para una operación real. Para crear cuentas de prueba, completa `SEED_ADMIN_*` y `SEED_USER_*` en `.env`; usa contraseñas propias de al menos 12 caracteres.
   Para carga de imágenes, crea un bucket público de Supabase Storage y configura `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET`. La llave de servicio se conserva solo en el backend y nunca se publica en el frontend.
5. Inicia el servidor:

   ```powershell
   npm run dev
   ```

   La API queda disponible en `http://localhost:3001`; verifica `/health`.

## Datos guardados

Las interacciones autenticadas de importación y exportación se vinculan con el usuario y el numeral seleccionado; los datos del formulario se almacenan en formato JSON. Las solicitudes de contacto son públicas y, si se envían con una sesión iniciada, quedan asociadas a esa cuenta. Usa únicamente información de prueba durante el desarrollo y restringe el acceso a la base de datos.

Las tablas de la base usan nombres en español: `usuarios`, `elementos_catalogo`, `interacciones` y `solicitudes_contacto`. Las migraciones de renombrado conservan los registros y las relaciones existentes. `elementos_catalogo.image_url` guarda la URL pública devuelta por Supabase Storage, no el archivo ni una URL ingresada manualmente.

## Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/register` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/auth/me` | Autenticado |
| POST | `/api/auth/admins` | Solo admin; registrar otro administrador |
| GET | `/api/catalogos?currentPage=1&limit=10&category=exportaciones&direction=INGRESOS&search=café` | Público; respuesta `{ data, pagination }` |
| GET | `/api/catalogos/:id` | Público |
| POST, PUT, DELETE | `/api/catalogos` y `/api/catalogos/:id` | Solo admin; DELETE desactiva el numeral para preservar historial |
| POST | `/api/catalogos/:id/imagen` (`multipart/form-data`, campo `image`) | Solo admin; JPG/PNG/WebP hasta 5 MB, URL subida a Supabase Storage y guardada en PostgreSQL |
| POST | `/api/solicitudes-contacto` | Público; opcionalmente autenticado para asociar la solicitud a la cuenta |
| POST | `/api/solicitudes-contacto/formularios` | Autenticado; guardar formularios de servicios asociados a la cuenta |
| GET | `/api/solicitudes-contacto/mias?currentPage=1&limit=10&tipoProducto=servicios` | Autenticado; solo registros propios, paginados |
| GET | `/api/solicitudes-contacto?currentPage=1&limit=10&search=empresa` | Solo admin; filtro por tipo y texto, paginado |
| GET, PUT, DELETE | `/api/solicitudes-contacto/:id` | Propietario o admin; los registros públicos sin propietario solo los administra el admin |
| POST | `/api/interacciones` | Autenticado |
| GET | `/api/interacciones/mias?currentPage=1&limit=10&type=formulario-importaciones` | Autenticado; solo interacciones propias, paginadas |
| GET | `/api/interacciones?currentPage=1&limit=10&type=formulario-exportaciones` | Solo admin; filtro por tipo, paginado |
| GET, PUT, DELETE | `/api/interacciones/:id` | Propietario o admin |

El registro y el login responden con `{ data: { user, token } }`. El token es un JWT con claims `id`, `role` y `exp`, firmado con `JWT_SECRET` y la duración configurada por `JWT_EXPIRES_IN`; ninguna respuesta incluye la contraseña ni su hash. Un correo ya registrado responde `409`; las credenciales inválidas de login responden `401` con un mensaje genérico.

Las rutas antiguas singulares (`/api/catalogo`, `/api/contacto` y `/api/interaccion`) siguen disponibles como alias de compatibilidad. Los listados paginados incluyen `total`, `currentPage`, `limit` y `totalPages` dentro de `pagination` (además de los alias `page` y `pageSize`); la página debe ser un entero positivo y el límite un entero entre 1 y 100. Los identificadores de recursos deben ser CUID válidos. Las actualizaciones parciales usan PUT y responden `200`; las creaciones `201`; los borrados `204`; las validaciones `400`; los conflictos `409`; la falta de autenticación `401`; y la falta de permisos `403` (los recursos inexistentes o fuera de propiedad responden `404`). Los errores conocidos de Prisma se traducen a respuestas seguras sin stack trace.

El registro siempre asigna el rol `USER`; el cliente no puede otorgarse permisos de administrador. Las interacciones toman el ID del usuario autenticado, nunca del cuerpo de la petición, y quedan vinculadas por llaves foráneas al usuario y al elemento del catálogo elegido. El login devuelve un JWT con los claims `id` y `role`; envíalo como `Authorization: Bearer <token>`. Para mantener compatibilidad temporal, la API también puede leer tokens anteriores que usaban `sub`.

Las respuestas de catálogo usan `{ pagination, data }`. Las respuestas de error no incluyen stack traces. CORS permite únicamente los orígenes configurados en `CORS_ORIGINS`.

### Ejemplos de autorización

Sin token o con un token inválido, un endpoint privado responde `401`:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Debes iniciar sesión para realizar esta acción." } }
```

Una cuenta con rol `USER` que intente administrar el catálogo recibe `403`:

```json
{ "error": { "code": "FORBIDDEN", "message": "No tienes permiso para realizar esta acción." } }
```

Para crear el primer administrador local, configura `SEED_ADMIN_*` en el `.env` y vuelve a ejecutar el seed. Una vez dentro del panel `/admin`, un administrador autenticado puede registrar otras cuentas administrativas. No hay credenciales administrativas predeterminadas en el código.

## Despliegue

Configura `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` y `CORS_ORIGINS` como variables del servicio. Ejecuta `npm run build` para compilar y `npm run prisma:deploy` para aplicar migraciones en producción; inicia con `npm start`. No uses las credenciales de desarrollo ni guardes secretos en GitHub.
