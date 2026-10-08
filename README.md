# Tienda online

Tienda web + TPV con **SvelteKit** (SSR, Node) y **PocketBase**. Plan completo y decisiones en
[`docs/PLAN.md`](docs/PLAN.md).

## Requisitos

- Node 22+ y pnpm 10+

## Arranque

```bash
pnpm install
cp .env.example .env      # ajusta PB_URL si hace falta
pnpm pb:download          # descarga el binario de PocketBase a ./pocketbase (una vez)
pnpm dev:all              # PocketBase (127.0.0.1:8090) + SvelteKit (localhost:5173)
```

Solo la web: `pnpm dev`. Solo PocketBase: `pnpm pb:serve`. En el primer arranque PocketBase pide
crear el superusuario en `http://127.0.0.1:8090/_/`.

## Scripts

| Comando             | Que hace                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm check`        | lint + colores + tests (lo mismo que CI, sin build)              |
| `pnpm test`         | tests con Vitest                                                 |
| `pnpm lint`         | ESLint + Prettier (`pnpm format` arregla el formato)             |
| `pnpm check:colors` | falla si el markup usa `base-*`, `success`, `warning` o `accent` |
| `pnpm build`        | build de produccion (`node build` para servirlo)                 |

## Convenciones

- JavaScript con Zod como fuente de verdad de esquemas; funciones y modulos, sin clases.
- Imports: `#core/*`, `#modules/*`, `#ui/*`. Rutas solo via `#core/routes.js`.
- Colores: solo `primary`, `secondary`, `info` y `error` de DaisyUI (ver `docs/PLAN.md` seccion 8).
- Sin `pb_hooks`: la logica va en SvelteKit; `pocketbase/pb_migrations/` solo guarda esquema.
