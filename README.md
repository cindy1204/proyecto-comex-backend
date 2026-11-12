# API de ColComex (backend)

API REST de comercio exterior hecha con Node.js, Express 5, TypeScript, Prisma 6 y PostgreSQL. Expone el catálogo de numerales cambiarios, las interacciones (formularios de importación, exportación, servicios, inversiones y endeudamiento) y las solicitudes de contacto, con autenticación JWT y roles `ADMIN` y `USER`. El frontend vive en otro repositorio ([proyecto-comex-frontend](https://github.com/cindy1204/proyecto-comex-frontend)) y consume esta API.

## Enlaces del proyecto

| Recurso                           | Enlace                                               |
| --------------------------------- | ---------------------------------------------------- |
| Repositorio del backend           | https://github.com/cindy1204/proyecto-comex-backend  |
| Repositorio del frontend          | https://github.com/cindy1204/proyecto-comex-frontend |
| Backend desplegado (API)          | Pendiente del despliegue                             |
| Frontend desplegado               | Pendiente del primer despliegue en Vercel            |
| Base de datos / proyecto Supabase | Pendiente de confirmar con el equipo                 |

## Reparto del trabajo

| Componente | Responsabilidades                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend   | Interfaz Next.js, navegación, autenticación en cliente, formularios, catálogo, solicitudes, experiencia adaptable y descarga de los formularios oficiales diligenciados en PDF. |
| Backend    | API REST, autenticación y roles, validación, persistencia PostgreSQL/Prisma, migraciones, seed de prueba, catálogo e integración con el frontend.                               |

Esta tabla describe la división técnica por repositorio; el equipo puede agregar los nombres de quienes asumieron cada parte.

## Arquitectura

Arquitectura limpia en cuatro capas; las dependencias apuntan hacia el dominio y todo se ensambla en un único punto (`src/interface/container.ts`).

```
src/
  domain/          modelos, contratos de repositorio (I*.repository) y de servicios (hash, token, archivos)
  application/     casos de uso, errores de aplicación, paginación y mappers a la forma pública
  infrastructure/  DTOs (Zod), repositorios Prisma, bcrypt, JWT, almacenamiento de imágenes (Supabase o PostgreSQL), configuración, logger
  interface/       controladores, routers Express, middlewares, app y contenedor de dependencias
  server.ts        arranque y apagado ordenado
prisma/            schema, migraciones y seed (datos en prisma/data)
tests/             unit/ (casos de uso, middlewares, JWT y repositorios Prisma con cliente simulado) y http/ (supertest sobre la app completa)
```

Los controladores no tocan Prisma: llaman a casos de uso, que dependen solo de las interfaces del dominio. Los tests inyectan repositorios en memoria, por lo que no requieren base de datos.

Los borrados de catálogo, interacciones y solicitudes son lógicos (`state` = `REMOVED` y `deletedAt`). Los montos usan `Decimal(14,2)` en la base y viajan como cadena (`"1500.50"`) para no perder precisión. Se aceptan solo decimales con punto, sin signo ni notación exponencial (`"1500.50"`, `"0.5"`); el frontend convierte la coma decimal antes de enviar.

**Imágenes:** el almacenamiento preferido es **Supabase Storage** (su API de objetos es compatible con S3). La imagen se envía en el mismo `POST`/`PUT` del catálogo, como `multipart/form-data` con el campo `image` (JPG, PNG o WebP, máximo 5 MB); el backend la sube a Supabase Storage si está configurado o, si no, a la base de datos (fallback), y guarda la URL en `imageUrl`. No existe un endpoint de subida aparte y el cliente no puede enviar `imageUrl`.

## Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL (local o administrado). Opcional: un proyecto de Supabase para guardar las imágenes; sin él se usa la misma base de datos.

## Instalación y ejecución

```bash
npm install
cp .env.example .env        # completa DATABASE_URL, DIRECT_URL (igual en local), JWT_SECRET y JWT_EXPIRES_IN
npm run prisma:deploy       # aplica las migraciones
npm run db:seed             # catálogo y cuentas de demostración (idempotente); también `npx prisma db seed`
npm run dev                 # http://localhost:3001  (verifica GET /health)
```

Para producción, consulta la sección [Despliegue](#despliegue).

`.env.example` documenta las variables requeridas y no contiene secretos. Copia el archivo a `.env` para desarrollo; nunca subas `.env` ni las credenciales de producción al repositorio.

## Variables de entorno

Detalladas y comentadas en `.env.example`. La API no arranca si falta alguna obligatoria (`DIRECT_URL` solo la lee Prisma CLI al migrar; la API en ejecución no la necesita).

| Variable                                    | Obligatoria | Descripción                                                                                                                                          |
| ------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | Sí          | Conexión PostgreSQL de Prisma (la que usa la API en ejecución)                                                                                       |
| `DIRECT_URL`                                | Para migrar | Conexión directa que usa `prisma migrate`; en local es igual a `DATABASE_URL`. En Supabase: directa (5432) frente al pooler (6543) de `DATABASE_URL` |
| `JWT_SECRET`                                | Sí          | Secreto de firma, mínimo 32 caracteres, sin valor por defecto                                                                                        |
| `JWT_EXPIRES_IN`                            | Sí          | Vigencia del token en segundos                                                                                                                       |
| `PORT`                                      | No          | Puerto HTTP (3001)                                                                                                                                   |
| `CORS_ORIGINS`                              | No          | Orígenes permitidos separados por comas; otros reciben 403                                                                                           |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | No          | Habilitan la subida de imágenes a Supabase Storage; sin ellas las imágenes se guardan en PostgreSQL (ver _Almacenamiento de imágenes_)               |
| `SUPABASE_STORAGE_BUCKET`                   | No          | Bucket público de imágenes (`catalogo`)                                                                                                              |
| `SEED_ADMIN_*`, `SEED_USER_*`               | No          | `NAME`, `EMAIL` y `PASSWORD` de las cuentas del seed                                                                                                 |

## Credenciales de prueba (seed)

El seed siempre crea un administrador y un usuario, y se puede repetir sin duplicar datos:

| Rol   | Correo                 | Contraseña     |
| ----- | ---------------------- | -------------- |
| ADMIN | `admin@colcomex.com`   | `Admin#2026`   |
| USER  | `usuario@colcomex.com` | `Usuario#2026` |

Son cuentas de demostración: en cualquier entorno compartido o público define `SEED_*` con valores propios. Si el correo ya existe, el seed no cambia su contraseña ni su rol. El seed también carga los numerales de `prisma/data/catalogo.json` y los de servicios de `prisma/data/servicios.json` (transcritos del Anexo 3 del DCIP-83, actualizado al 1 de septiembre de 2021; confirma su vigencia antes de usarlos en una operación real).

Para poblar únicamente el catálogo sin crear ni modificar usuarios, ejecuta `npm run db:seed:catalog-only`. Antes, define `DATABASE_URL` y `DIRECT_URL` con la URL externa de la base de producción de Render y `CATALOG_SEED_TARGET=production`. El script inserta numerales faltantes, omite duplicados y rechaza URLs locales; no imprime las URLs ni accede a la tabla de usuarios.

Para crear únicamente el primer administrador en producción, configura `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL=admin@colcomex.com` y `SEED_ADMIN_PASSWORD` (mínimo 12 caracteres) en el entorno del servicio backend. Después de desplegar una compilación exitosa, desde una consola segura conectada a ese entorno ejecuta `ADMIN_CREATE_CONFIRM=CREATE_ADMIN:admin@colcomex.com npm run db:create-admin`. El comando crea solo esa cuenta, nunca cambia usuarios existentes y no carga ni modifica el catálogo. Si el correo ya existe, termina con error sin modificarlo. No ejecutes `db:seed` para este propósito y no imprimas ni registres la contraseña.

## Endpoints

Todas las rutas están bajo `/api`, salvo `/health`. Los éxitos con cuerpo tienen la forma `{ "data": ... }`; los borrados responden 204 sin cuerpo. **PUT y PATCH son equivalentes**: ambos hacen una actualización parcial (basta enviar los campos que cambian, al menos uno) con las mismas validaciones y permisos; se conserva PUT por compatibilidad con el frontend. Los errores tienen la forma `{ "error": { "code", "message", "details"? } }` y los listados `{ "data": [...], "pagination": { "total", "currentPage", "limit", "totalPages" } }` (`page` por defecto 1; `limit` por defecto 10, máximo 50; valores inválidos responden 400; un parámetro vacío como `?page=` equivale a ausente). Los ids son `cuid`; un id inválido responde 400. Autenticación: `Authorization: Bearer <token>`.

| Método      | Ruta                             | Acceso                                                                                                                                                    |
| ----------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/health`                        | Público; 200 `{ "status": "ok" }`, o 503 si la base de datos no responde                                                                                  |
| POST        | `/api/auth/register`             | Público; 201 con `{ "data": { user, token, expiresIn } }`; correo repetido 409                                                                            |
| POST        | `/api/auth/login`                | Público; 200 con `{ "data": { user, token, expiresIn } }`, o 401 "Credenciales inválidas."                                                                |
| GET         | `/api/auth/me`                   | Autenticado; `{ "data": user }`                                                                                                                           |
| POST        | `/api/auth/admins`               | Solo admin; 201 con `{ "data": user }`; crea otro administrador                                                                                           |
| GET         | `/api/catalogos`                 | Público; filtros `category`, `direction`, `search`, `createdFrom`, `createdTo`; `state=ACTIVE\|REMOVED\|ALL` solo para admin                              |
| GET         | `/api/catalogos/:id`             | Público (los eliminados solo los ve un admin)                                                                                                             |
| POST        | `/api/catalogos`                 | Solo admin; JSON o `multipart/form-data` con `image`; duplicado 409 (si el existente está eliminado, el mensaje indica restaurarlo con `state: "ACTIVE"`) |
| PUT y PATCH | `/api/catalogos/:id`             | Solo admin; JSON o multipart; actualización parcial; `state: "ACTIVE"` restaura un numeral eliminado                                                      |
| GET         | `/api/archivos/:id`              | Público; sirve una imagen guardada en la base de datos (fallback sin Supabase) con su `Content-Type` y caché de un día                                    |
| DELETE      | `/api/catalogos/:id`             | Solo admin; borrado lógico 204 (si ya estaba eliminado, 404)                                                                                              |
| POST        | `/api/interacciones`             | Autenticado                                                                                                                                               |
| GET         | `/api/interacciones`             | Solo admin; filtros `type`, `userId`, fechas                                                                                                              |
| GET         | `/api/interacciones/mias`        | Autenticado; solo las propias                                                                                                                             |
| GET         | `/api/interacciones/:id`         | Propietario o admin (ajeno: 404)                                                                                                                          |
| PUT y PATCH | `/api/interacciones/:id`         | Propietario o admin                                                                                                                                       |
| DELETE      | `/api/interacciones/:id`         | Propietario o admin; borrado lógico 204                                                                                                                   |
| POST        | `/api/solicitudes-contacto`      | Público; con token válido queda asociada a la cuenta, con token inválido 401                                                                              |
| GET         | `/api/solicitudes-contacto`      | Solo admin; filtros `tipoProducto`, `search`, fechas                                                                                                      |
| GET         | `/api/solicitudes-contacto/mias` | Autenticado; solo las propias                                                                                                                             |
| GET         | `/api/solicitudes-contacto/:id`  | Propietario o admin                                                                                                                                       |
| PUT y PATCH | `/api/solicitudes-contacto/:id`  | Propietario o admin                                                                                                                                       |
| DELETE      | `/api/solicitudes-contacto/:id`  | Propietario o admin; borrado lógico 204                                                                                                                   |

Tipos de interacción (campo `type`, valores en kebab-case): `formulario-importaciones`, `formulario-exportaciones`, `formulario-servicios`, `formulario-inversiones` y `formulario-endeudamiento`. Los tres últimos son declaraciones de cambio: su `data` sigue un contrato estricto (`declarationDataSchema` en `src/application/interaction-data.ts`) con `fechaTramite`, `tipoIdentificacion`, `identificacion`, `nombreTitular`, `monedaNegociacion`, `valorMonedaNegociacion`, `tasaCambioDolares`, `valorTotalDolares`, `observaciones` (opcional), `nombreDeclarante` y `numeralCambiario`; cualquier otra clave responde 400. Ese conjunto de campos es un núcleo común pendiente de confirmar con el Anexo 1 de la DCIP-83, que no lo especifica por familia. Con `PUT`, cambiar una declaración a otra familia de declaración es válido siempre que el numeral pertenezca a la categoría nueva; si no, responde 400. Cambiar una declaración a importación o exportación se rechaza, porque sus campos no coinciden. La migración `20261111120000_interaction_type_declaraciones` añade los tres valores al enum de PostgreSQL. Se verificó en una base PostgreSQL 16 local desechable (aplica limpia y sin deriva frente a `schema.prisma`); **no se ha aplicado a ninguna base compartida ni de producción**.

Códigos: 400 validación o JSON/ruta mal formados, 401 sin token o token inválido (incluido el de un usuario eliminado), 403 sin permiso u origen CORS no permitido, 404 no existe o es ajeno, 409 duplicado o referencia en conflicto, 413 cuerpo mayor a 1 MB o imagen mayor a 5 MB, 415 imagen que no es JPG/PNG/WebP, 429 límite de peticiones, 502 fallo del almacenamiento de imágenes. Ningún error expone trazas.

Límites de peticiones (por proceso): 300 por 15 minutos en `/api`, 20 en autenticación, 10 en contacto y 60 por hora y por usuario en escrituras del catálogo (cargas de imagen). Los formularios multipart aceptan como máximo un archivo de 5 MB, 10 campos de texto y 40 000 bytes por campo.

## Cómo probar

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint + typescript-eslint
npm run format:check  # Prettier
npm test            # Vitest + supertest
npm run test:coverage # igual, con cobertura (@vitest/coverage-v8)
npm run build
```

Las pruebas usan repositorios en memoria, así que no necesitan PostgreSQL ni Supabase. Cubren los casos de uso, los middlewares, el servicio JWT (token expirado, otro secreto, `alg: none`, `sub` ausente o ajeno) y los flujos HTTP completos (roles, borrado lógico, paginación, subida de imágenes con un almacenamiento simulado, límites multipart, JSON inválido, `%` en la ruta y CORS). Los repositorios Prisma se prueban con un `PrismaClient` simulado que comprueba filtros, `search`, `skip`/`take`, orden y soft-delete; el SQL real solo se ejercita contra PostgreSQL.

## Despliegue

Pasos para un servicio Node (Render, Railway u otro) con la base de datos en Supabase. No guardes secretos en GitHub: las variables se definen en el panel del servicio.

1. **Variables del servicio:** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS` (con el dominio del frontend desplegado) y, si habilitas imágenes, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (opcionalmente `SUPABASE_STORAGE_BUCKET`) si quieres las imágenes en Supabase; si no, no hace falta nada más para las imágenes. `PORT` suele inyectarlo la plataforma.
2. **Build command:**

   ```bash
   npm ci --include=dev && npx prisma migrate deploy && npm run build
   ```

   `--include=dev` es necesario porque `prisma` (migraciones y `prisma generate`) y `tsx` (seed) son `devDependencies`; si la plataforma instala solo producción, el build falla. `npm run build` ejecuta `prisma generate` y compila a `dist/`. Requiere Node 20 o superior (`engines` en `package.json`).

3. **Start command:** `npm start` (ejecuta `node dist/server.js`).
4. **Base de datos Supabase:** en Project Settings > Database > Connection string copia el **pooler** (puerto 6543, con `?pgbouncer=true`) en `DATABASE_URL` y la **conexión directa** (puerto 5432) en `DIRECT_URL`. Prisma usa `DIRECT_URL` para migrar, porque las migraciones no funcionan a través del pooler; la API usa `DATABASE_URL`. En local ambas son iguales.
5. **Seed (`npm run db:seed`):** córrelo una sola vez tras la primera migración, desde tu equipo con `DATABASE_URL` y `DIRECT_URL` apuntando a la base de Supabase, o como comando puntual en el servicio (requiere las `devDependencies`, por eso el build usa `--include=dev`). Define `SEED_*` con valores propios: sin ellos crea las cuentas de demostración públicas de este README. Es idempotente, pero no es parte del build ni del arranque.
6. **URL pública:** al crear el servicio web, el proveedor (por ejemplo, Render) asigna un dominio HTTPS. Copia esa URL base en `NEXT_PUBLIC_API_HOST` del frontend y añade el dominio exacto de Vercel a `CORS_ORIGINS` del backend.
7. **Verificación:** `GET <URL del backend>/health` debe responder `{ "status": "ok" }`.

Por ejemplo, en Render crea **New → Web Service**, conecta `cindy1204/proyecto-comex-backend` y selecciona la rama que el equipo decidió publicar. Configura el comando de compilación indicado arriba y `npm start` como comando de inicio; Render muestra la URL del servicio al terminar el despliegue. Configura allí los secretos y conexiones de producción. No copies el `.env` local al servicio ni al repositorio.

### Almacenamiento de imágenes

Supabase es opcional. Con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` definidas, las imágenes van al bucket de Supabase. Sin ellas, las imágenes se guardan en la tabla `archivos_almacenados` de PostgreSQL (migración `20261112100000_archivos_almacenados`) y la API las sirve desde `GET /api/archivos/:id`; así funcionan en Render sin configurar nada más. Los pasos siguientes son solo para usar Supabase.

1. En el panel de Supabase abre **Storage** y crea un bucket llamado `catalogo` marcado como **público** (las imágenes se sirven por su URL pública; las escrituras solo las hace el backend con la llave de servicio).
2. Copia la URL del proyecto en `SUPABASE_URL` (`https://<proyecto>.supabase.co`) y la llave `service_role` en `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API). Esta llave salta las políticas de seguridad: solo va en el backend, nunca en el frontend ni en GitHub. Si usas otro nombre de bucket, defínelo en `SUPABASE_STORAGE_BUCKET`.
3. Prueba la subida con un token de administrador (`POST /api/auth/login` con la cuenta del seed):

   ```bash
   curl -X POST "$API_URL/api/catalogos" \
     -H "Authorization: Bearer $TOKEN" \
     -F category=importaciones -F direction=EGRESOS -F code=9999 \
     -F title="Prueba de imagen" -F description="Numeral de prueba" \
     -F image=@archivo.png
   ```

   La respuesta 201 trae `imageUrl` con la URL pública del archivo en el bucket. Sin las variables de Supabase, `imageUrl` es relativa (`/api/archivos/<id>`) y apunta a la imagen guardada en la base de datos.

## Reglas de validación de los formularios

Las reglas viven en `src/application/interaction-data.ts` y se aplican a `data` en crear y editar. El frontend aplica las mismas reglas antes de enviar (`src/features/interactions/domain/`); aquí es donde se hacen cumplir. Un cuerpo que las incumple responde 400 `VALIDATION_ERROR` con el campo en `details`.

- **Montos y tasas:** decimales con punto, sin signo, sin punto final (`1.`) y sin notación científica. Los montos son mayores que cero, con hasta 15 cifras enteras y 2 decimales (los ceros a la izquierda no cuentan); las tasas son mayores que cero, con hasta 6 decimales. `valorFob`, `valorReintegrado`, `totalValorFob`, `totalGastosExportacion` y `deducciones` admiten cero.
- **Total en dólares = valor × tasa (provisional):** el total debe coincidir con `valorMonedaNegociacion × tasa` (`tipoCambioDolar` en importaciones, `tasaCambioDolares` en exportaciones y declaraciones), redondeado a centavos con mitad hacia arriba y con una tolerancia de un centavo. Ver la pregunta abierta sobre la dirección de la tasa en _Limitaciones conocidas_.
- **Fechas:** `fechaTramite` no puede ser futura según la hora de Bogotá (`America/Bogota`) y debe existir (p. ej. `2026-02-30` se rechaza).
- **Monedas:** solo códigos ISO 4217 vigentes de la lista del código (sin fondos, metales, `XXX` ni monedas retiradas). La comparación distingue mayúsculas.
- **Identificación según el tipo:** NIT de 6 a 10 dígitos con dígito de verificación obligatorio (`-` y un dígito, validado con el algoritmo de la DIAN); cédula de ciudadanía, 6 a 10 dígitos; cédula de extranjería, 6 a 20 alfanuméricos; pasaporte, 5 a 20 alfanuméricos. Las longitudes de cédula y pasaporte son aproximadas y no están tomadas de un anexo oficial.
- **Campos desconocidos:** los formularios son estrictos; un campo que no pertenece a la familia de la interacción responde 400.

## Limitaciones conocidas

- **Dirección de la tasa sin confirmar:** la API valida `total = valor × tasa`, que es la convención de estos formularios. Si la tasa es un TRM en pesos por dólar, el cálculo correcto sería `valor / tasa` y la validación rechazaría datos correctos. Hay que confirmarlo antes de usar datos reales.
- **Registros existentes:** un registro guardado antes de estas reglas, con una moneda no vigente o un total que no cumple valor × tasa, falla al editarse hasta que se corrige.
- **Proxy de confianza:** la API declara `trust proxy 1` para leer la IP del cliente que reenvía el proxy (Render) en los límites de peticiones. Si se despliega detrás de más de un proxy, ajusta ese valor; con uno solo, el riesgo de falsear la IP es bajo.
- **Límites por proceso:** los contadores de `express-rate-limit` viven en memoria. Con varias instancias, cada una cuenta por separado.
- **Imagen opcional:** al crear un numeral la imagen es opcional. El soporte de subida existe; no se exige una imagen por numeral.
- **Almacenamiento no verificado con credenciales reales:** la subida a Supabase Storage y el fallback en PostgreSQL (`archivos_almacenados`) están implementados y cubiertos con almacenamiento simulado; no se probaron con un proyecto de Supabase real ni con la base de Render.
- **Despliegue pendiente:** las URLs y el proyecto de Supabase de la tabla de enlaces están por confirmar.

## Uso de inteligencia artificial

Se usó un asistente de IA (Claude) para reestructurar el código en capas, implementar el contrato, escribir las pruebas y redactar este README. Se probó contra una base PostgreSQL real con curl y con la suite de pruebas. El equipo debe revisar el código y ser capaz de explicarlo; las subidas reales a Supabase Storage no se probaron con credenciales reales.
