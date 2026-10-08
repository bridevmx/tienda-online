# Roadmap posterior a la fase 9

Documento vivo. Marca `[x]` lo terminado. Las fases 0 a 9 del proyecto están en
[`PLAN.md`](PLAN.md); aquí vive lo que sigue: validación de Clip, seguridad, pruebas, funciones nuevas,
operación y mejoras técnicas. El orden de las secciones es el orden recomendado de ejecución.

Prioridad: **P0** bloquea salir a producción · **P1** antes o poco después del lanzamiento ·
**P2** mejora importante · **P3** futuro.

---

## 1. Clip: alinear con la API oficial (P0) — _en curso_

Fuentes: [crear link](https://developer.clip.mx/reference/createnewpaymentlink),
[consultar estado](https://developer.clip.mx/reference/checkpaymentlinkstatus),
[webhooks](https://developer.clip.mx/reference/webhookshxo). Informe completo y decisiones en
[`CLIP.md`](CLIP.md).

Regla central: **el webhook es un aviso, no una prueba**. Trae solo `id`, `origin` y `event_type`, sin
firma. Solo sirve para saber qué link consultar con `GET /v2/checkout/{id}`; un pedido se da por pagado
únicamente si Clip responde `CHECKOUT_COMPLETED` con **nuestra** referencia, **nuestro** monto y
**nuestra** moneda, y existe `receipt_no`.

- [x] Webhook oficial: leer `id` (UUID) en lugar de `payment_request_id`; ignorar ids que no existen en
      la base sin llamar a Clip.
- [x] Referencia propia por pago, firmada con HMAC y de ≤ 36 caracteres, enviada en
      `metadata.external_reference` y comparada en timing-safe al verificar.
- [x] Estados exactos: `CREATED`/`PENDING` → pendiente (reintentable); `CANCELLED`/`EXPIRED` → fallido;
      `COMPLETED` → pagado solo tras validar referencia, monto, moneda y `receipt_no`. Un estado
      desconocido nunca cuenta como pagado.
- [x] `receipt_no` único (un recibo no puede acreditar dos pedidos).
- [x] Anomalías (monto, moneda o referencia distintos en un pago completado) **no** cancelan el pedido:
      quedan señaladas en el pago (`provider_note`) y en el log para revisión manual, porque el cliente
      sí pagó.
- [x] `redirection_url` con `success`, `error` y `default` (la portada), `custom_payment_options` con
      crédito y débito, descripción ≤ 250 caracteres.
- [x] Respuesta 200 inmediata al webhook; la verificación corre después. Límite de peticiones por IP.
- [x] Reconciliador (`npm run jobs:reconcile-payments`) para webhooks perdidos (Clip no documenta
      reintentos); `jobs:expire-orders` reconcilia antes de cancelar.
- [x] Errores de Clip tipados (401 token, 403 región, 412 límite) leyendo `message` o `code_message`.
- [x] Autenticación configurable: `CLIP_API_TOKEN` (valor tal cual del header `Authorization`) o
      `CLIP_API_KEY`/`CLIP_API_SECRET` (Basic).
- [ ] **Probar en el sandbox/cuenta real de Clip** (lo único que no se puede verificar sin cuenta):
  - [ ] Formato exacto del header `Authorization` aceptado.
  - [ ] Que el webhook realmente llega con `{ id, origin, event_type }` y a qué ritmo.
  - [ ] Si hay reintentos y qué respuesta espera Clip.
  - [ ] Contradicción de la doc: `expires_at` por defecto 3 días vs. "los links vencen a la hora".
  - [ ] Que `GET` devuelve `amount` en pesos y `receipt_no` al completarse.
  - [ ] Región del servidor (Clip responde 403 fuera de México y EE. UU.).

## 2. Seguridad

- [ ] **P0** Cabeceras HTTP en `hooks.server.js`: CSP, HSTS, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`.
- [ ] **P0** Ejecutar `/security-review` sobre todo el diff y revisar a mano las reglas de la API de
      PocketBase.
- [ ] **P1** Bitácora de auditoría: quién confirmó, canceló o reembolsó, cambios de rol/permisos y de
      ajustes (hoy solo se guarda `confirmed_by`).
- [ ] **P1** Límite de intentos compartido (hoy en memoria, válido solo para una instancia de Node).
- [ ] **P1** Subidas: validar el contenido real del archivo (magic bytes) además del tipo declarado, y
      limpieza periódica de comprobantes huérfanos.
- [ ] **P1** `npm audit` / Dependabot y escaneo de secretos en CI.
- [ ] **P2** Sesiones del personal con caducidad corta y 2FA (PocketBase soporta OTP/MFA para `users`).
- [ ] **P2** Rotación de `CLIP_WEBHOOK_TOKEN` sin perder avisos (aceptar dos tokens durante la
      transición).

## 3. Pruebas

- [ ] **P1** Concurrencia intensa: 20 compradores por la última pieza; webhook duplicado en paralelo.
- [ ] **P1** Navegador: cobro con tarjeta en el TPV, flujo de cuenta, variantes en móvil.
- [ ] **P1** Accesibilidad automatizada (axe) y navegación por teclado.
- [ ] **P2** Migraciones: actualizar desde una base con datos, no solo desde cero.
- [ ] **P2** Carga: listado de ventas, catálogo del TPV completo, checkout.
- [ ] **P3** Capturas visuales de los temas claro y oscuro.

## 4. Funciones nuevas

**Alta prioridad (P1)**

- [ ] Cuadre de caja en el TPV: abrir y cerrar caja con el efectivo esperado.
- [ ] Correos transaccionales de pedido: confirmación, pago recibido, enviado.
- [ ] Envíos/entrega: dirección, método y costo (hoy el pedido no tiene dirección).
- [ ] Facturación CFDI, si aplica.

**Media prioridad (P2)**

- [ ] Reportes y exportación a CSV.
- [ ] Ajustes de inventario con historial de movimientos.
- [ ] Cupones.
- [ ] Clientes en el admin (el permiso `customers:read` ya existe).
- [ ] Devolución parcial.

**Futuro (P3)**

- [ ] Importación masiva de productos.
- [ ] Varias imágenes por variante.
- [ ] Aviso de stock bajo.
- [ ] Panel de inicio con métricas.

## 5. Operación y despliegue (P0/P1)

- [ ] **P0** Dockerfile o unit de systemd; HTTPS con proxy; PocketBase solo en red interna; SMTP real.
- [ ] **P0** Variables de producción: `ADDRESS_HEADER`, `PROTOCOL_HEADER`, `HOST_HEADER`,
      `BODY_SIZE_LIMIT`, `CLIP_*`.
- [ ] **P0** Programar con cron: `jobs:reconcile-payments` (cada 2–5 min) y `jobs:expire-orders`
      (cada 15 min).
- [ ] **P0** Respaldos de `pb_data` y prueba de restauración.
- [ ] **P0** Crear superusuario y personal, `permissions:sync`, cargar catálogo real, registrar el
      webhook en Clip.
- [ ] **P1** Logging estructurado, endpoint de salud y alertas (webhooks fallidos, anomalías de pago,
      errores no capturados).
- [ ] **P1** Revisar el tratamiento fiscal de la comisión integrada y del descuento con un contador.

## 6. Mejoras técnicas

- [ ] **P2** Rendimiento: paginar/buscar en servidor cuando el catálogo del TPV pase de unos cientos de
      variantes; caché de páginas públicas; optimizar imágenes; índices en `orders`
      (`created_by`, `created`, `contact_email`).
- [ ] **P2** Accesibilidad: contraste de los 4 colores en ambos temas, foco del diálogo, lectores de
      pantalla.
- [ ] **P2** SEO: imágenes Open Graph y revisión de datos estructurados.
- [ ] **P3** Dividir `modules/sales/service.js` (ya es grande) por responsabilidad.
- [ ] **P3** TPV con soporte sin conexión.
