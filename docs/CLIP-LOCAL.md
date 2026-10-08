# Validar Clip en local con pagos reales ($1)

Guía para probar la integración con Clip **en tu computadora**, con dinero real pero de $1. Complementa
[`CLIP.md`](CLIP.md) (diseño y decisiones) y cierra la lista de pendientes de [`ROADMAP.md`](ROADMAP.md) §1.

> Usa **un solo comprador y montos de $1**. Cada prueba pagada es un cobro real: pide el reembolso desde
> tu panel de Clip al terminar (los reembolsos de la tienda `/admin/ventas` solo cambian el estado interno).

## 0. Requisitos

- Node 22+, npm 10+, `git`.
- Credenciales de la API de Clip (token, o key + secret) de **tu cuenta**.
- Una máquina en **México o EE. UU.** (Clip responde 403 desde otras regiones; ojo con las VPN).
- Un túnel HTTPS para que Clip alcance tu webhook: [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
  (`cloudflared tunnel --url http://localhost:3000`) o `ngrok http 3000`.

## 1. Preparar

```bash
git clone <URL-DEL-REPO> ~/Documentos/tienda-online-clip && cd ~/Documentos/tienda-online-clip
git checkout claude/sveltekit-pocketbase-shop-plan-xerxjm
npm install
cp .env.example .env
npm run pb:download
```

Edita `.env`:

```bash
PB_ADMIN_EMAIL=admin@tienda.local
PB_ADMIN_PASSWORD=una-contrasena-larga
CLIP_API_URL=https://api.payclip.com
CLIP_API_TOKEN=...           # o CLIP_API_KEY + CLIP_API_SECRET
CLIP_WEBHOOK_TOKEN=...       # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Terminal A — PocketBase y datos iniciales (una sola vez):

```bash
npm run pb:serve                                     # déjalo corriendo
# en otra terminal:
npm run pb:superuser -- admin@tienda.local "una-contrasena-larga"
npm run permissions:sync
npm run create-staff -- --email tu@correo.com --name "Tu Nombre" --role admin
npm run seed:clip-test        # crea "Producto de prueba $1" (SKU PRUEBA-1, neto $1.00, 50 piezas)
```

## 2. Prueba 0 — credenciales y formato de la API (sin la tienda)

```bash
npm run clip:check
```

Crea un link real de $1 y lo imprime. Debe decir **"Clip aceptó las credenciales"** y mostrar
`id`, `referencia` y `pagar en`. Si responde:

- **401** → revisa el token y si Clip espera `Basic` (key + secret) o el token tal cual (`CLIP_API_TOKEN`).
- **403** → región/VPN.
- **400** → copia el mensaje: es el detalle de Clip sobre el campo inválido.

Paga el link con `npm run clip:check -- --wait`. Al terminar imprime cinco comprobaciones (estado
COMPLETADO, referencia, monto, moneda MXN, `receipt_no`). **Todas deben salir ✓**; anota el `receipt_no`.
Esto responde por sí solo los puntos 1 y 5 de §7 de `CLIP.md` (header y forma real del `GET`).

## 3. Levantar la tienda con túnel

1. Inicia el túnel y copia la URL pública (`https://xxxx.trycloudflare.com`).
2. Compila y arranca la tienda usando **esa URL como origen** (la tienda arma el webhook y los retornos a
   partir del origen de la solicitud):

```bash
npm run build
ORIGIN=https://xxxx.trycloudflare.com ADDRESS_HEADER=x-forwarded-for PORT=3000 node --env-file=.env build/index.js
```

3. Entra **siempre por la URL pública** (no por `localhost`) y abre `/admin` con tu usuario.
4. En `/admin/ajustes`: para cobrar **exactamente $1.00** apaga _Aplicar IVA a todos los productos_ e
   _Incluir la comisión de Clip en los precios_ (déjalos encendidos para la prueba 12).

## 4. Pruebas con dinero real

Para cada una, el resultado esperado y dónde comprobarlo. En PocketBase (`http://127.0.0.1:8090/_/`,
colección `payments`) mira `status`, `reference`, `receipt_no`, `provider_ref`, `provider_note`; en
`/admin/ventas/<pedido>` ves el estado, el recibo y las alertas.

| #   | Prueba                                                                                                                                                                                                                       | Resultado esperado                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Pago feliz web.** Producto de prueba → carrito → checkout → tarjeta → pagar $1 en Clip.                                                                                                                                    | Regresas a `/pedido/...` con **Pagado**. `payments.status = confirmed`, `receipt_no` lleno, `provider_event_id` = id del link. Stock −1. |
| 2   | **Recargar** `/pedido/...` 5 veces tras pagar.                                                                                                                                                                               | Nada cambia: un solo pago, un solo descuento de stock.                                                                                   |
| 3   | **Webhook llega** (revisa la terminal de la tienda y la hora de `paid_at`).                                                                                                                                                  | Si `paid_at` es de antes de volver a la tienda, el webhook funcionó. **Anota el retraso.** Si siempre se confirma al volver, no llega.   |
| 4   | **Cerrar la pestaña** justo después de pagar en Clip; esperar 1 min; abrir `/admin/ventas`.                                                                                                                                  | Pedido **Pagado** (webhook) o, si no, tras `npm run jobs:reconcile-payments` (respaldo).                                                 |
| 5   | **Webhook falso, UUID inventado:** `curl -X POST "$URL/api/webhooks/clip?token=$TOKEN" -H 'content-type: application/json' -d '{"id":"3f2a9c1e-5b7d-4e8a-9c0b-1a2b3c4d5e6f","origin":"checkout-api","event_type":"UPDATE"}'` | `200 {"ok":true}`. No cambia nada (en logs de Clip no hay consulta).                                                                     |
| 6   | **Webhook falso con id REAL pendiente** (crea otro pedido con tarjeta, no pagues, manda el curl con su `provider_ref`).                                                                                                      | `200`, el pedido sigue **pendiente** (la tienda preguntó a Clip y no estaba pagado).                                                     |
| 7   | **Sin token / token malo** en el curl.                                                                                                                                                                                       | `403`.                                                                                                                                   |
| 8   | **Retorno falsificado:** abre `/pedido/<codigo>?t=<token>&pago=ok&status=CHECKOUT_COMPLETED` sin haber pagado.                                                                                                               | Sigue **pendiente**.                                                                                                                     |
| 9   | **Webhook caído:** apaga el túnel, paga otro link de $1, enciende el túnel, corre `npm run jobs:reconcile-payments`.                                                                                                         | El script informa `pagados 1` y el pedido pasa a **Pagado**.                                                                             |
| 10  | **Fallar 5 veces** la tarjeta en Clip (tarjeta rechazada) o dejar vencer un link.                                                                                                                                            | `payments.status = failed`; el pedido sigue pendiente y puedes **cambiar a transferencia** desde `/pedido/...`.                          |
| 11  | **TPV con QR:** `/tpv` → producto → Cobrar → Tarjeta → escanear el QR con el teléfono y pagar.                                                                                                                               | La pantalla pasa sola a **Pagado** (sondeo cada 3 s), ticket imprimible.                                                                 |
| 12  | **Cálculo real:** enciende IVA y comisión; compra el producto con tarjeta.                                                                                                                                                   | Total ≈ $1.20 con IVA y comisión integrados; Clip cobra ese monto; `order_financials.net_total` ≈ $1.00. El cliente nunca ve "comisión". |
| 13  | **Pago tardío:** crea pedido con tarjeta, **cancélalo** en `/pedido`, luego paga el link.                                                                                                                                    | El pedido sigue **Cancelado** con nota "Pago recibido después de cancelar… reembolsar", y el pago `confirmed`.                           |
| 14  | **Vencimiento sin perder un pago:** pon `orders.pending_ttl_hours` en 1, paga y corre `npm run jobs:expire-orders`.                                                                                                          | El pedido pagado **no** se cancela.                                                                                                      |
| 15  | **Dos pestañas/clientes** compran la última pieza (pon stock 1 en `PRUEBA-1`).                                                                                                                                               | Uno compra; el otro ve "se agotó"; nunca queda stock negativo.                                                                           |

Anomalías (monto/moneda/referencia distintas, recibo repetido) no se pueden provocar con un cobro real
sin manipular a Clip; están cubiertas por pruebas automáticas (`npm run test:integration`).

## 5. Qué llevarte de las pruebas

Rellena esto y compártelo para ajustar la integración:

- Header de autenticación que funcionó: **token** / **Basic** / otro.
- ¿Llegó el webhook? **sí/no**, retraso aproximado, forma del cuerpo (¿solo `id`, `origin`, `event_type`?).
- ¿Hubo reintentos al fallar nuestro endpoint (prueba 9)?
- ¿`GET` devolvió `amount` en pesos y `receipt_no` solo al completarse?
- ¿Cuánto dura realmente un link sin pagar (3 días vs. "a la hora")?
- Cualquier error `4xx/5xx` de Clip con su mensaje.

## 6. Limpieza

- Pide el reembolso de los cobros de prueba en tu panel de Clip.
- Vuelve a encender IVA y comisión en `/admin/ajustes`.
- Desactiva o borra el producto de prueba (`/admin/products`) y detén túnel y servicios.
- Rota `CLIP_WEBHOOK_TOKEN` y el token de API si los compartiste en algún log o captura.
