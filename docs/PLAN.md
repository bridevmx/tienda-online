# Plan: tienda online (SvelteKit + PocketBase)

Documento vivo. Resume las decisiones acordadas y las fases. Marca `[x]` lo terminado.

## 1. Principios

- **SvelteKit (SSR, `adapter-node`) en JavaScript.** Sin TypeScript por ahora; **Zod** es la fuente
  unica de verdad de los esquemas (formularios, payloads, webhooks, CRUD del admin).
- **PocketBase solo como base de datos, auth y archivos.** Cero `pb_hooks`. Todo lo demas vive en
  SvelteKit. `pb_migrations/` solo contiene esquema (campos, indices unicos, relaciones, reglas).
- **El navegador nunca habla con PocketBase**; solo SvelteKit, y PocketBase queda en red interna.
- **Sin campos JSON** en el esquema: todo con colecciones y relaciones.
- **Convencion de esquema:** toda coleccion termina con los campos `created` y `updated` (autodate), en
  ese orden y al final. Al agregar campos a una coleccion en una migracion nueva hay que volver a
  dejarlos al final (la migracion `1791500200_timestamps_last.js` lo hizo con las existentes);
  `npm run check:schema` lo verifica contra una instancia en marcha.
- **Funciones y modulos, sin clases.** Servicios con factory (`createXService(pb)`), nucleo funcional
  puro (`computeTotals`, `findVariant`) y cascaron imperativo (servicios, rutas).
- **Una sola moneda (MXN) y solo espanol.** Dinero siempre en centavos enteros; tasas en puntos base.
- **UI compartida** entre tienda web y TPV (`src/ui`), con DaisyUI.

## 2. Arquitectura

```
src/
├─ core/       pb · auth · can · routes · pricing · money · themes · module · crud
├─ modules/    catalog · sales · payments (cash, clip, transfer) · access · settings
│              cada uno: schema · service · permissions · resources · components · index
├─ ui/         componentes DaisyUI compartidos (web + TPV)
└─ routes/     (shop) (auth) (pos) (admin) api/webhooks
pocketbase/pb_migrations/   solo esquema
scripts/                    pb-download · pb-serve · dev · check-colors · permissions:sync · seed
```

- **Modulo = carpeta con manifiesto** (`defineModule`): nav, permisos, recursos CRUD. Se registra
  en `src/modules/index.js`, el unico archivo a tocar para agregar un modulo.
- **CRUD generico:** `createCrudService(pb, coleccion, schema)` + rutas `[resource]`. Un modulo nuevo
  declara `resources.js` y obtiene tabla y formulario del admin sin codigo extra.
- **Patrones:** servicio por modulo (DI manual via `locals.services`), registro de modulos,
  estrategia de pago (`{ createCharge, verifyWebhook }`), caso de uso como comando (`placeOrder`),
  Post/Redirect/Get con form actions. Sin repositorios genericos ni eventos hasta que hagan falta.
- Imports con subpath imports de Node: `#core/*`, `#modules/*`, `#ui/*` (ver `package.json`).

## 3. Colecciones

- Catalogo: `categories` (con `parent`), `products`, `options`, `option_values`, `variants`
  (`values` = relacion multiple a `option_values`; un producto simple tiene una variante sin valores).
  Una variante no puede repetir opcion (se valida con Zod).
- Acceso: `users` (auth, personal; `role` → `roles`), `roles` (`permissions` multi-relacion, `system`),
  `permissions` (`code` `modulo:accion`, sincronizados desde los manifiestos con `permissions:sync`).
- `customers` (**auth separada** de `users`; login opcional; solo ven lo suyo).
- `settings` (clave-valor global con registro Zod en codigo).
- Ventas: `orders` (`channel` web|pos, `status`, totales en centavos, instantanea de tasas),
  `order_items` (instantanea de nombre, SKU y precio), `payments` (`method`: cash | card_clip | transfer).

## 4. Roles y seguridad

- Dos capas con los mismos datos: `can(user, 'products:update')` en SvelteKit y reglas de API de
  PocketBase que recorren `@request.auth.role.permissions.code`.
- Dos clientes de PocketBase: `locals.pb` (token del usuario, reglas aplican) y `adminPb()`
  (superusuario; solo checkout de invitado, webhook de Clip, scripts).
- Roles iniciales: cajero (TPV, ver catalogo, crear pedidos), gerente (catalogo, stock, descuentos,
  anulaciones, reportes), admin (todo, usuarios, configuracion). Un rol `system` no se puede borrar y
  nadie puede quitarse a si mismo el rol admin.

## 5. Precios, IVA y comisión de Clip

Banderas en `settings`: `tax.apply_iva`, `clip.apply_fee`, `pricing.discount_non_card`.
Valores: `tax.iva_rate` (16), `clip.fee_rate` (ej. 2.9, **de toda la tienda**; cambia con promociones),
`clip.fee_fixed`. El precio guardado es lo que la tienda quiere recibir **neto**.

```
k = tasa_clip × (1 + IVA)            (comision + IVA de la comision; este IVA siempre aplica)
i = tasa_iva si tax.apply_iva, si no 0
B = (precio + fijo × (1 + IVA)) / (1 − k × (1 + i))     si clip.apply_fee, si no precio
IVA_venta = B × i ;  Total (tarjeta) = B + IVA_venta
Efectivo / transferencia (con pricing.discount_non_card): descuento = B − precio,
                        IVA sobre el subtotal ya descontado.
```

Ejemplo (precio 1,000, IVA 16 %, Clip 2.9 % + IVA): tarjeta 1,040.61 + 166.50 = **1,207.11**;
efectivo/transferencia 1,040.61 − 40.61 + 160.00 = **1,160.00**; sin IVA: 1,034.82 / 1,000.00.
Todo se redondea hacia arriba al centavo. **Validar con el contador** el tratamiento fiscal; el calculo
vive en una sola funcion pura (`computeTotals`) para poder cambiarlo en un solo lugar.

- El **cliente nunca ve la comision**: ve subtotal, descuento por efectivo/transferencia, IVA y total.
  `computeTotals` devuelve `customerView` e `internal`; las rutas publicas solo serializan
  `customerView` y un mapper `toCustomerOrder()` quita campos internos (con test).
- En la pagina de producto del **personal** (admin/TPV) hay switches de IVA y comision como
  simulador: muestran lo que paga el cliente y **lo que te queda**.
- El pedido guarda la instantanea de tasas y montos; cambiar la configuracion no altera ventas pasadas.

## 6. Pagos

- **Efectivo** (TPV): el pedido nace `paid`.
- **Clip:** link de pago + webhook idempotente (verificar autenticidad segun la documentacion vigente
  de Clip; no asumir el mecanismo). Solo el webhook marca un pago como completado.
- **Transferencia:** pedido `pending` con su `code` como referencia, datos bancarios desde `settings`,
  comprobante opcional, confirmacion por personal con `payments:confirm` (quien y cuando).
- Pedidos pendientes **reservan stock** y lo liberan al cancelarse o vencer
  (`orders.pending_ttl_hours`, 24 h); lo ejecuta un script con cron del sistema, no un hook.
- `placeOrder` usa el batch transaccional de PocketBase; el stock se descuenta con el modificador
  `stock-` y `min: 0` hace fallar (y revertir) el batch si no alcanza. _Confirmar con la version
  instalada que el batch esta habilitado y que el modificador funciona dentro de el._
- Mientras un pedido esta `pending`, `changePaymentMethod` recalcula totales; uno pagado no se edita.

## 7. Clientes y cuenta

- Login opcional. Checkout como invitado guarda el contacto en el pedido; al registrarse un cliente
  con **correo verificado** se le asocian sus pedidos de invitado.
- `/pedido/[code]?t=<token>` para consultar pedidos de invitado (el token evita enumerar codigos).
- `/cuenta`: tarjetas de pedidos con estatus (texto + color, nunca solo color) y acciones de pago
  si estan pendientes. `/cuenta/perfil`: nombre, telefono, correo (reverificacion), contrasena.
  Nada mas.

## 8. UI y temas

- Solo clases de DaisyUI. **4 colores: `primary`, `secondary`, `info`, `error`.** `success`, `warning`
  y `accent` son alias en el tema (DaisyUI los exige) y **no se usan en el markup**; tampoco `base-*`.
  `npm run check:colors` lo vigila en CI.
- Significado: primary = accion principal / "pagado"; secondary = acciones secundarias / destacado;
  info = informativo / pendiente / stock bajo; error = errores / agotado / anulado.
- Temas en `src/app.css`, registrados en `src/core/themes.js`; el tema se guarda en cookie y se
  aplica en el servidor (sin parpadeo).
- TPV: layout a pantalla completa, botones grandes, busqueda con foco automatico y soporte de codigo
  de barras, carrito en store local, un boton "Cobrar".
- Referencias de Mobbin: Amazon / adidas / Selfridges (detalle con variantes), Selfridges / Etsy /
  Klarna (listado con filtros), **Square** / Fresha / Sweatpals (TPV), Shopify / Wix / Whop (tablas
  CRUD), Faire (checkout).

## 9. Rutas (URLs en espanol, codigo en ingles; constructores en `src/core/routes.js`)

```
(shop)  /  /productos  /productos/[slug]  /categorias/[slug]  /carrito  /checkout
        /pedido/[code]?t=…   /cuenta  /cuenta/perfil
(auth)  /entrar  /registro  /recuperar  /verificar
(admin) /admin/entrar  /admin  /admin/[resource]  /admin/[resource]/nuevo  /admin/[resource]/[id]
        /admin/ventas  /admin/ventas/[id]  /admin/ajustes
(pos)   /tpv  /tpv/ventas
api     /api/webhooks/clip          (solo webhooks)
```

- `hooks.server.js` solo lee la sesion y llena `locals`; cada `+layout.server.js` de grupo llama a
  `requirePermission(...)`. Form actions + PRG en lugar de endpoints `/api`.
- `[resource]` usa un matcher de parametros que acepta solo recursos registrados.

## 10. Control de ventas

Un solo modelo para web y TPV: reportes por canal, dia, cajero y metodo (incluye descuentos por
metodo). PocketBase no agrega (`GROUP BY`): se agrega en SvelteKit; si el volumen crece, una coleccion
resumen `sales_daily`. Apertura/cierre de caja queda como feature futura (`orders.session` opcional).

## 11. Fases

- [x] **0. Cimientos** — SvelteKit JS con `adapter-node`, Tailwind 4 + DaisyUI 5 con temas y control
      de colores en CI, Zod, Vitest, ESLint/Prettier, estructura `core/modules/ui`, scripts de
      PocketBase local, CI.
- [x] **1. Acceso** — `users`, `roles`, `permissions`, `customers`; `permissions:sync`; cookies y
      `locals` dobles; `can()`, `requirePermission`; reglas de API. Login/logout de personal
      (`/admin/entrar`) y de clientes (`/entrar`); registro, verificacion y recuperacion de clientes
      quedan en la fase 7. Probado contra PocketBase 0.40.4 real (52 comprobaciones de flujo web y
      reglas de API); falta convertirlo en pruebas automaticas con una instancia temporal (fase 9).
- [x] **2. Catalogo** — migracion (categories, products, options, option_values, variants), reglas
      por permiso, modulo `catalog` (esquemas Zod, reglas de integridad, servicio) y
      `npm run seed:catalog`. Probado contra PocketBase 0.40.4 (48 comprobaciones de reglas, campos,
      borrados protegidos y servicio; la migracion sube y baja).
- [x] **3. Admin generico** — `/admin/[resource]`, `createCrudService`, tabla y formulario generados
      desde la definicion del recurso + Zod; categorias, roles, opciones (con sus valores), productos
      (con sus variantes) y variantes, con imagenes. Probado contra PocketBase 0.40.4 (80 comprobaciones
      del admin por HTTP, mas las de fases 1 y 2); 123 tests unitarios. Pendiente: generador de
      combinaciones de variantes y administrar `users`/`customers` desde el admin.
- [x] **4. Ajustes** — coleccion `settings` (clave-valor), registro Zod con tipos y valores por defecto,
      lectura cacheada para el servidor y `/admin/ajustes` (solo admin: incluye la comision de Clip).
      Se agrego la infraestructura de **pruebas de integracion** (`npm run test:integration`): PocketBase
      temporal + servidor compilado + dobles de SMTP y de Clip; las comprobaciones de las fases 1-3 ya
      corren ahi.
- [x] **5. Precios y tienda** — `computeTotals` (BigInt, con casos de referencia y propiedades),
      portada, listado con busqueda, categorias, detalle con selector de variantes (enlaces, sin JS),
      carrito en cookie validado contra la base, simulador de IVA/comision solo para personal, SEO
      (titulo, canonical, JSON-LD, sitemap, robots). 197 tests unitarios + pruebas de integracion de la
      tienda (incluye que ninguna pagina publica filtre la comision).
- [x] **6. Ventas y pagos** — `placeOrder` transaccional (batch con `stock-`, reintentos), checkout web,
      tarjeta por link de Clip con webhook idempotente (se re-consulta el estado a Clip; token en la
      URL con comparacion en tiempo constante), transferencia con comprobante privado, cambio de
      metodo, cancelacion, pago tardio, vencimiento por script (`npm run jobs:expire-orders`),
      `/admin/ventas` (resumen, filtros) y detalle con confirmar / completar / cancelar / reembolsar.
      Pruebas de integracion con doble de Clip y de SMTP (27 en total).
- [x] **7. Cuenta del cliente** — registro, verificacion de correo, recuperar contrasena y cambio de
      correo (plantillas de PocketBase apuntando a `/verificar`, `/recuperar`, `/correo`; migracion
      `1791500600`), `/cuenta` con pedidos en tarjetas, `/cuenta/perfil` (datos, correo, contrasena).
      Los pedidos de invitado se vinculan solo con el correo YA verificado. Limite de intentos
      (`core/rate-limit.js`, en memoria) en accesos, registro y envios de correo. 35 pruebas de
      integracion (sumidero SMTP legible por HTTP). Detras de un proxy configura `ADDRESS_HEADER`.
- [ ] **8. TPV.**
- [ ] **9. Calidad** — tests de `computeTotals` (ejemplos de la seccion 5), `can`, schemas,
      `placeOrder`, que no se filtre la comision; Playwright de humo.

## 12. Notas de implementacion (fase 1)

- **Sesion:** la cookie (`pb_staff` / `pb_customer`, httpOnly, SameSite=Lax) guarda solo el token;
  en cada solicitud se relee el registro con `role.permissions`, asi que revocar un permiso, cambiar
  de rol o desactivar a alguien aplica de inmediato. Tokens: personal 12 h, clientes 30 dias.
- **Aislamiento:** un token de cliente en la cookie de personal no da acceso (las reglas exigen
  `@request.auth.collectionName = "users"`).
- **Escalada de privilegios:** nadie puede cambiarse a si mismo el rol ni el estado, ni borrarse; los
  roles `system` (admin) no se editan ni se borran desde la app; el admin se mantiene con
  `permissions:sync`.
- **`permissions:sync`** es idempotente: un permiso nuevo llega solo a los roles de su lista
  `roles` (y a admin); un rol nuevo recibe sus permisos por defecto; lo editado en la app no se pisa.
- **Registro de clientes abierto** (`createRule` vacio): un cliente no tiene privilegios fuera de sus
  datos. Pendiente: limitar intentos (rate limit de PocketBase y/o en SvelteKit) en fase 7/9.
- **SvelteKit 3:** la configuracion vive en `vite.config.js` (no hay `svelte.config.js`); los alias
  `$core` etc. estan deprecados, por eso se usan subpath imports (`#core/*`).
- **adapter-node 6:** el origen sale de las cabeceras; sin `PROTOCOL_HEADER` asume `https` (ver README).
- **Descarga de PocketBase:** `npm run pb:download` resuelve la ultima version por GitHub o, si no se
  puede, por el proxy de modulos de Go. Probado con 0.40.4 y el SDK `pocketbase` 0.28.1.

## 13. Notas de implementacion (fase 2)

- **Lectura publica solo de lo activo** (categoria, producto; una variante ademas exige producto
  activo). El personal con `<recurso>:read` ve tambien lo inactivo. Opciones y valores son publicos.
  PocketBase expone todos los campos de un registro visible (p. ej. `stock`), asi que la tienda no le
  pasa registros crudos al navegador: el servicio los mapea (`getBySlug` ya devuelve solo lo necesario).
- **Precio y stock no son `required`:** en PocketBase un numero requerido rechaza el 0. Siguen siendo
  enteros `>= 0`, y Zod (`variantSchema`) los exige.
- **Borrados protegidos con reglas, no con hooks:** una categoria con subcategorias y un valor de opcion
  usado por una variante no se borran (`categories_via_parent.id = ""`, `variants_via_values.id = ""`);
  productos en una categoria y valores en una opcion los protege la relacion requerida. Borrar un
  producto borra sus variantes. Las reglas que referencian a otra coleccion se asignan despues de crearla.
- **Integridad en SvelteKit** (`modules/catalog/rules.js`, funciones puras con tests): una variante no
  repite opcion; todas las variantes de un producto usan las mismas opciones (un producto simple
  tiene una sola variante sin valores); categorias de un solo nivel.
- **Errores de dominio:** `DomainError` (con `field`) y `guard()` traducen los errores de validacion de
  PocketBase (p. ej. slug o SKU duplicado) para que los formularios del admin los pinten en su campo.
- **Slugs** se generan desde el nombre si se dejan vacios (`core/slug.js`). La descripcion es HTML
  (campo `editor`): hay que sanitizarla al mostrarla en la tienda (fase 5).
- **Imagenes:** campos de archivo (jpeg/png/webp, 5 MB) con miniaturas `160x160`, `480x480` y `960x0`.

## 14. Notas de implementacion (fase 3): el CRUD generico

**Agregar un recurso al admin** (sin tocar rutas ni componentes): en el modulo, `defineResource({...})` y
ponerlo en `resources` del manifiesto. Lo que declara:

- `name` (segmento de URL y coleccion), `label: [singular, plural]`, `feminine` (Nueva/Nuevo).
- `permissions: { read, create, update, delete }`: `collectResources` falla si algun codigo no esta
  declarado en algun modulo (un typo no deja el recurso sin proteccion en silencio).
- `schema` (Zod: valida en el servidor), `columns` (tipos: text, code, muted, bool, money, integer, stock,
  relation, relations, count, date, image), `fields` (text, textarea, html, integer, money, checkbox,
  relation, relations, groups, image, images), `search`, `defaultSort`, `expand`, `filters`, `children`
  (tablas de hijos en la pagina de edicion, con "Agregar" que prellena la clave foranea y vuelve al
  padre), `canEdit`/`canDelete` (p. ej. roles `system`) y `service(pb)` para reglas propias.
- Los campos `options` traen su lista desde otra coleccion (`label`, `group`, `hint`).

**Rutas:** `/admin/<recurso>` (lista), `/nuevo`, `/<id>` (editar; acciones `?/save` y `?/delete`).
Las rutas especificas (`/admin/ventas`, `/admin/ajustes`) ganan por especificidad. En lugar de un matcher
de parametros, un recurso inexistente responde 404 desde el `load` (asi el cliente no carga los
recursos). SvelteKit no permite una accion `default` junto a acciones con nombre: la edicion usa `save`.

**Seguridad:** cada pagina y accion pide el permiso del recurso; los parametros de la URL (`q`, `sort`,
`page`, filtros) se validan contra lo que el recurso permite y la busqueda usa parametros enlazados;
los campos `immutable` (p. ej. el producto de una variante) se ignoran al editar; los nombres de
archivo a quitar se validan; el texto se escapa (Svelte) y la descripcion HTML solo se guarda.
Nadie puede editar el rol que tiene asignado (migracion `1791500300`), para evitar escalada.

**Datos de formulario:** un checkbox sin marcar llega como ausente: `toInput` lo vuelve `'off'` (no
"el valor por defecto", que lo dejaria siempre activo). El dinero se escribe en pesos y se guarda en
centavos (`toInput`/`toFormValues`). Los select de "opciones" de una variante envian un valor por
opcion; el servicio valida que no se repita ni falte ninguna (regla del catalogo).

**Imagenes:** se guardan en PocketBase y se sirven por `GET /media/<coleccion>/<id>/<archivo>?thumb=`
(solo categorias, productos y variantes; solo imagenes; solo las miniaturas configuradas). La subida
va en una segunda llamada tras guardar los datos; si falla en un registro nuevo, se borra para no dejarlo
a medias. En campos de varios archivos se agregan (`campo+`) y se quitan con casillas.

**Mensajes:** una cookie de un solo uso (`flash`) muestra el aviso tras guardar o eliminar. Los colores
de aviso usan `info` y `error` (el tema no tiene "success").

## 15. Notas de implementacion (fase 4)

- **Ajustes:** `settings` guarda solo `key` y `value` (texto); `src/modules/settings/registry.js` define
  cada clave (tipo, defecto, etiqueta, validacion) y es la fuente de verdad. Un valor igual al defecto
  no crea registro; un booleano que el formulario no envia queda apagado. Leer ajustes en el servidor:
  `await locals.settings()` (cache de 30 s que se invalida al guardar; usa `locals.adminPb`).
- **Variables de entorno en SvelteKit 3:** solo existen las declaradas en `src/env.js`
  (`defineEnvVars`) y se leen con `$app/env/private`; `$env/dynamic/private` ya no entrega las no
  declaradas. Hasta la fase 3 el servidor ignoraba `PB_URL` (siempre usaba 8090); lo destapo la nueva
  infraestructura de integracion, que usa puertos aleatorios.
- **Pruebas de integracion** (`tests/integration`): `global-setup.js` levanta PocketBase en un directorio
  temporal (migraciones + `permissions:sync` + personal + catalogo de ejemplo), compila y arranca el
  servidor, y un SMTP y un Clip de mentira; `support.js` trae un "navegador" con cookies
  (`client()`/`staff()`), acceso a la API de PocketBase y `ok()`. Sin binario de PocketBase se omiten.
  `IT_SKIP_BUILD=1` reutiliza `build/`; `IT_DEBUG=1` muestra los logs de los servidores.

## 16. Notas de implementacion (fase 5)

- **`computeTotals`** (`core/pricing.js`) usa BigInt y redondea hacia arriba; los casos de referencia son
  tests. Propiedad verificada: con tarjeta, a la tienda le queda el precio guardado (±1-2 centavos a su
  favor). El cargo fijo de Clip tambien se integra. `customerView` {subtotal, discount, iva, total} es lo
  unico que llega al navegador; `internal` {clipFee, clipFeeIva, net} solo al personal.
- **Estructura "view/server":** `buildCart()` devuelve `view` (serializable, sin precios base ni comision) y
  `server` (lo que necesita el checkout). Los listados y la pagina de producto reciben solo precios
  finales por metodo; existencias reales solo hasta 10 piezas. Una prueba de integracion rastrea todas
  las paginas publicas buscando "Clip", "comision" y llaves internas en HTML y datos serializados.
- **Carrito:** cookie `cart` [{v, q}] (30 dias, httpOnly); precios, stock y disponibilidad se leen
  SIEMPRE de la base. Las lineas se repartiran el TOTAL (con IVA, igual que la pagina de producto) por
  mayor residuo para que sumen exacto. Lo no comprable se marca y bloquea el pago.
- **Pagina de producto:** la seleccion (`?v=<valor>`) vive en la URL: funciona sin JS, se comparte y el
  chip de un valor agotado/imposible se ve distinto. El simulador del personal conserva `?iva=&clip=`.
- **Descripcion HTML:** se sanea en el servidor (`sanitize-html`, `core/html.js`); `{@html}` solo se usa
  con contenido saneado o JSON propio.
- **Variables en desarrollo:** en `vite dev` las variables salen de `.env` (copia `.env.example`).

## 17. Pendiente de validar

- Tratamiento fiscal de la comision integrada en el precio y del descuento en la factura (contador).
- Mecanismo de verificacion de webhooks de Clip (documentacion vigente).
- Version de PocketBase: batch transaccional y modificador `stock-`.
- Variables obligatorias de temas de DaisyUI al agregar nuevos temas.
