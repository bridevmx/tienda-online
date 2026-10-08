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

Solo la web: `npm run dev`. Solo PocketBase: `npm run pb:serve`. En el primer arranque PocketBase pide
crear el superusuario en `http://127.0.0.1:8090/_/`.

## Scripts

| Comando                | Que hace                                                         |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run check`        | lint + colores + tests (lo mismo que CI, sin build)              |
| `npm test`             | tests con Vitest                                                 |
| `npm run lint`         | ESLint + Prettier (`npm run format` arregla el formato)          |
| `npm run check:colors` | falla si el markup usa `base-*`, `success`, `warning` o `accent` |
| `npm run build`        | build de produccion (`node build` para servirlo)                 |

## Convenciones

- JavaScript con Zod como fuente de verdad de esquemas; funciones y modulos, sin clases.
- Imports: `#core/*`, `#modules/*`, `#ui/*`. Rutas solo via `#core/routes.js`.
- Colores: solo `primary`, `secondary`, `info` y `error` de DaisyUI (ver `docs/PLAN.md` seccion 8).
- Sin `pb_hooks`: la logica va en SvelteKit; `pocketbase/pb_migrations/` solo guarda esquema.
