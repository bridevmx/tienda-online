# Tienda online

Tienda web + TPV con **SvelteKit** (SSR, Node) y **PocketBase**. Plan completo y decisiones en
[`docs/PLAN.md`](docs/PLAN.md).

## Requisitos

- Node 22+ y npm 10+

## Arranque

```bash
npm install
cp .env.example .env      # ajusta PB_URL si hace falta
npm run pb:download          # descarga el binario de PocketBase a ./pocketbase (una vez)
npm run dev:all              # PocketBase (127.0.0.1:8090) + SvelteKit (localhost:5173)
```

Solo la web: `npm run dev`. Solo PocketBase: `npm run pb:serve`.

### Primer arranque (una sola vez)

```bash
npm run pb:superuser -- admin@tienda.local "una-contrasena-larga"   # superusuario de PocketBase
# pon ese correo y contrasena en .env (PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD)
npm run permissions:sync                                            # permisos y roles base
npm run create-staff -- --email tu@correo.com --name "Tu Nombre" --role admin
```

Luego entra en `http://localhost:5173/admin/entrar`. Las migraciones de `pocketbase/pb_migrations/` se
aplican solas cuando arranca PocketBase. Tras agregar permisos en un modulo, vuelve a correr
`npm run permissions:sync` (no pisa lo que edites en la app).

### Produccion (adapter-node)

Con `adapter-node` el origen de la solicitud se deduce de las cabeceras. Detras de un proxy con TLS
define `PROTOCOL_HEADER=x-forwarded-proto` y `HOST_HEADER=x-forwarded-host` (y haz que el proxy las
envie); si no, SvelteKit asume `https` y bloquea los formularios (`403 Cross-site POST`) o las cookies
no coinciden. PocketBase debe quedar en red interna, sin exponerse a internet.

## Scripts

| Comando                    | Que hace                                                                          |
| -------------------------- | --------------------------------------------------------------------------------- |
| `npm run check`            | lint + colores + tests (lo mismo que CI, sin build)                               |
| `npm test`                 | tests con Vitest                                                                  |
| `npm run lint`             | ESLint + Prettier (`npm run format` arregla el formato)                           |
| `npm run check:colors`     | falla si el markup usa `base-*`, `success`, `warning` o `accent`                  |
| `npm run permissions:sync` | sincroniza permisos y roles base desde los modulos (`-- --prune` borra obsoletos) |
| `npm run build`            | build de produccion (`node build` para servirlo)                                  |

## Convenciones

- JavaScript con Zod como fuente de verdad de esquemas; funciones y modulos, sin clases.
- Imports: `#core/*`, `#modules/*`, `#ui/*`. Rutas solo via `#core/routes.js`.
- Colores: solo `primary`, `secondary`, `info` y `error` de DaisyUI (ver `docs/PLAN.md` seccion 8).
- Sin `pb_hooks`: la logica va en SvelteKit; `pocketbase/pb_migrations/` solo guarda esquema.
