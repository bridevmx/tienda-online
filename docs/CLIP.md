# Clip: links de pago (API oficial)

Fuentes: [crear link](https://developer.clip.mx/reference/createnewpaymentlink),
[consultar estado](https://developer.clip.mx/reference/checkpaymentlinkstatus) y
[webhooks](https://developer.clip.mx/reference/webhookshxo). Lo de la sección 1 y 2 sale de esas tres
páginas; lo que la documentación no dice está en la sección 3. Cómo lo implementa este proyecto, en la 4.

## 1. La idea central

El webhook de Clip trae **solo tres datos**: `id`, `origin` y `event_type`. No incluye estado, monto,
firma ni headers de autenticación documentados. Por eso es **un aviso, no una prueba**.

> Nunca se da un pedido por pagado por lo que diga un webhook ni por la URL de retorno. Son solo una
> señal para **preguntarle a Clip** con `GET /v2/checkout/{id}`. Se acepta únicamente si Clip responde
> `CHECKOUT_COMPLETED` con **nuestra** referencia, **nuestro** monto y **nuestra** moneda, y existe
> `receipt_no`.

## 2. Datos oficiales de la API

**Autenticación.** Header `Authorization` con el token (`ApiKeyAuth`). Siempre desde el **servidor**.

| Acción           | Endpoint                                                       |
| ---------------- | -------------------------------------------------------------- |
| Crear link       | `POST https://api.payclip.com/v2/checkout`                     |
| Consultar estado | `GET https://api.payclip.com/v2/checkout/{payment_request_id}` |

**Al crear (obligatorios):** `amount` (mínimo 1, hasta 2 decimales), `currency` (`MXN`),
`purchase_description` (≤ 250) y `redirection_url` con `success`, `error` y `default` (los tres).
`error` se usa tras 5 intentos fallidos; `default` es la URL de la tienda.

**Opcionales útiles:** `metadata.external_reference` (≤ 36 caracteres, guiones y acentos permitidos,
quita espacios), `webhook_url`, `expires_at` (UTC; > 1 min después de crear y antes de las 23:59:59
CDMX del mismo día; por defecto 3 días) y `custom_payment_options` (`payment_method_types`:
`debit`/`credit`/`cash`, `payment_method_brands`, `international_enabled`, `installments_msi`).

**Respuesta de crear:** `payment_request_id` (UUID), `payment_request_url`, `status`, `qr_image_url`.

**Respuesta de consultar:** `status`, `amount`, `currency`, `metadata.external_reference`,
`payment_request_id` y `receipt_no` — **solo cuando el estado es `CHECKOUT_COMPLETED`**.

**Estados:** `CHECKOUT_CREATED` (creado) · `CHECKOUT_PENDING` (esperando pago) · `CHECKOUT_CANCELLED`
(5 intentos fallidos) · `CHECKOUT_EXPIRED` · `CHECKOUT_COMPLETED` (liquidado).

**Webhook:** se activa enviando `webhook_url` al crear. Cuerpo:
`{ "id": "<uuid>", "origin": "checkout-api", "event_type": "INSERT" | "UPDATE" }`
(`INSERT` pago nuevo, `UPDATE` cambio de estado).

**Errores:** 400 (001–004), 401 (011, token incorrecto), 403 (servidor fuera de México y EE. UU.),
412 (031, límite de peticiones), 500 (101). El cuerpo trae `message` o `code_message`.

## 3. Lo que la documentación NO dice (tratar como desconocido)

- El webhook **no tiene firma** documentada: cualquiera que conozca la URL puede mandar un POST falso.
- **No hay política de reintentos documentada**: un webhook perdido puede no volver → hace falta respaldo.
- No se documenta qué respuesta espera Clip del endpoint (se responde `200` rápido).
- No hay lista de IPs de origen.
- **Contradicción:** `expires_at` dice 3 días por defecto, pero la descripción de estados dice que los
  links "vencen a la hora". Probar en la cuenta antes de depender de ello.
- **Orden de eventos:** el webhook puede llegar antes de que la consulta refleje el cobro → `pending`
  es reintentable.
- Formato de errores inconsistente (`message` / `code_message`).

## 4. Cómo lo implementa este proyecto

| Pieza                                  | Dónde                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Cliente de la API                      | `src/modules/payments/clip.js`                                         |
| Referencia firmada                     | `src/core/reference.js`                                                |
| Verificación (único camino a "pagado") | `src/modules/payments/clip-webhook.js` (`verifyClipPayment`)           |
| Endpoint del webhook                   | `src/routes/api/webhooks/clip/+server.js`                              |
| Retorno del comprador / TPV            | `src/modules/payments/sync.js` (`syncCardPayment`)                     |
| Reconciliador (webhooks perdidos)      | `src/modules/payments/reconcile.js`, `npm run jobs:reconcile-payments` |
| Crear el link                          | `src/modules/sales/service.js` (`startClipPayment`)                    |
| Esquema                                | migración `1791500700_clip_verification.js`                            |
| Doble para pruebas                     | `tests/integration/mocks/clip.js`                                      |

**Flujo.**

1. `placeOrder` crea pedido + pago pendiente (en una transacción, con el stock reservado).
2. `startClipPayment` guarda `reference = TDA-<id del pago>-<HMAC 8>` (≤ 36) **antes** de llamar a Clip y
   crea el link con `amount` (MXN, 2 decimales), `metadata.external_reference`, `redirection_url`
   (`success` = pedido, `error` = pedido con `?pago=error`, `default` = portada), `webhook_url` con token y
   `custom_payment_options` crédito/débito. Se guardan `provider_ref` (UUID) y `provider_url`.
3. El comprador paga en Clip. Llega el webhook (`200` inmediato, verificación después), regresa el
   comprador a `/pedido/...` o el TPV sondea cada 3 s, o corre el reconciliador. **Los cuatro caminos
   hacen lo mismo:** `verifyClipPayment`.
4. `verifyClipPayment(linkId)`:
   - `linkId` debe ser UUID **y existir en `payments.provider_ref`**; si no, se ignora **sin llamar a Clip**.
   - Pago ya `confirmed`/`refunded` → nada que preguntar.
   - `GET /v2/checkout/{id}`. `CANCELLED`/`EXPIRED` → el intento falla (el pedido sigue pendiente: puede
     cambiar de método). `CREATED`/`PENDING` y cualquier estado desconocido → pendiente.
   - `COMPLETED` → se valida **referencia** (firma + coincide con el pago), **monto** (centavos), **moneda**
     (`MXN`) y que exista **`receipt_no`**; sin recibo todavía → pendiente. Un recibo ya usado por otro pago
     (índice único) es anomalía.
   - Todo coincide → `confirmPayment` (idempotente; guarda `provider_event_id` y `receipt_no`).

**Seguridad aplicada.**

- Monto siempre del servidor (`order.total` recalculado), nunca del request.
- Referencia firmada con HMAC y comparada en tiempo constante; ids de Clip validados como UUID.
- Webhook: token en la URL (filtro extra), límite de 120 peticiones por minuto y por IP, nunca se usa su
  contenido más allá del `id`, y ids desconocidos no producen llamadas a Clip.
- La URL de retorno no prueba nada; las consultas a Clip desde páginas se limitan (1 cada 2 s por pago).
- Activación idempotente: `confirmPayment` no hace nada si el pedido ya estaba pagado.
- Los secretos (`CLIP_*`) solo viven en variables de entorno del servidor.

## 5. Desviaciones respecto al pseudocódigo del informe (y por qué)

1. **Anomalías no marcan el pago como `failed`.** El informe marca `failed` si monto/moneda/referencia no
   coinciden. Aquí, un pago que Clip dice completado pero no cuadra **no se confirma ni se cancela**: el
   cliente sí pagó, y cancelar el pedido liberaría el stock con dinero ya cobrado. Queda una nota en
   `payments.provider_note`, un `console.error` y el reconciliador sale con código 1 la primera vez
   (después ya no repite). El personal lo ve en el detalle de la venta y decide (reembolso o corrección).
2. **Referencia = id del pago + firma**, en vez de una cadena aleatoria nueva: así la referencia queda
   ligada a un pago concreto y es verificable sin consultar la base.
3. **Sin `usuario_id`/sesión en la verificación.** Nuestros pedidos se consultan con token propio del
   pedido (invitados) o sesión del cliente; la verificación solo mueve estados y no revela datos.
4. **No se envía `expires_at`.** El vencimiento lo manda el pedido (`orders.pending_ttl_hours`, 24 h) y
   `jobs:expire-orders`. Si el pedido vence y el comprador paga después en Clip, el webhook lo registra como
   **pago tardío** (el pedido no se reabre; queda marcado para reembolsar).
5. **El reconciliador revisa solo pagos pendientes** de los últimos 3 días. `jobs:expire-orders`
   reconcilia antes de cancelar, así un pago cuyo aviso se perdió no vence por error.
6. **Respuesta `200` inmediata** y verificación en segundo plano (`void` + log), como pide el informe; la
   red de seguridad es el reconciliador.

## 6. Configuración

```bash
# .env (ver .env.example)
CLIP_API_URL=https://api.payclip.com
CLIP_API_TOKEN=            # valor tal cual del header Authorization (prioridad)…
CLIP_API_KEY=              # …o el par key + secret (Authorization: Basic base64(key:secret))
CLIP_API_SECRET=
CLIP_WEBHOOK_TOKEN=        # largo y aleatorio; va en la URL del webhook y firma las referencias
```

Webhook: lo registra la tienda en cada link con `webhook_url` =
`https://TU-TIENDA/api/webhooks/clip?token=<CLIP_WEBHOOK_TOKEN>` (no hay que configurarlo en el panel de
Clip). El servidor debe estar en México o EE. UU. (si no, Clip responde 403).

Cron:

```cron
*/5  * * * *  cd /ruta/tienda && npm run -s jobs:reconcile-payments >> reconcile.log 2>&1
*/15 * * * *  cd /ruta/tienda && npm run -s jobs:expire-orders      >> expire.log    2>&1
```

Rotar `CLIP_WEBHOOK_TOKEN` invalida las referencias ya emitidas (cambian de firma): hacerlo sin pagos
pendientes, o esperar a que venzan los links.

## 7. Pruebas

- **Unitarias:** `clip.test.js` (formato oficial, estados, errores 401/403/412, UUID, https),
  `clip-webhook.test.js` (todas las anomalías, recibo duplicado, pago tardío, ids ajenos),
  `reconcile.test.js`, `core/reference.test.js` (firma).
- **Integración** (`tests/integration/clip.test.js`, `orders.test.js`, `pos.test.js`) contra un doble que
  imita la API oficial: aviso falso, id ajeno sin llamada a Clip, anomalías de monto/moneda/referencia,
  recibo tardío y duplicado, link vencido/cancelado, URL de retorno falsificada, reconciliador,
  vencimiento sin cancelar un pago real, límite del webhook.

### Pendiente: probar en el sandbox / cuenta real de Clip

Lo único que no se puede verificar sin cuenta (anotado en [`ROADMAP.md`](ROADMAP.md) §1):

1. Formato exacto del header `Authorization` aceptado (Basic vs. token).
2. Que el webhook llega con `{ id, origin, event_type }`, con qué retraso y si hay reintentos.
3. Qué respuesta espera Clip de nuestro endpoint.
4. La contradicción de `expires_at` (3 días vs. "a la hora").
5. Que `GET` devuelve `amount` en pesos y `receipt_no` al completarse.
6. Que el servidor de producción no recibe 403 por región.
7. Los ocho escenarios del informe: pago de monto bajo y recarga (se activa una vez); POST falso con UUID
   inventado (no llama a Clip); POST falso con UUID real pendiente (sigue pendiente); referencia falsa;
   referencia de otra sesión; cerrar la pestaña tras pagar; endpoint caído + reconciliador; link vencido.
