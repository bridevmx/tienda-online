/// <reference path="../pb_data/types.d.ts" />
/**
 * Fase 6: ventas. orders, order_financials, order_items y payments (web y TPV comparten modelo),
 * y habilita el API batch (transacciones) que usa `placeOrder` para crear el pedido y reservar
 * stock de forma atomica.
 *
 * NADIE escribe estas colecciones desde la API con un token de usuario (create/update/delete = null):
 * todo pasa por el servidor con el superusuario (src/modules/sales), que valida y recalcula totales.
 * Lectura: el cliente ve lo suyo, el personal segun permisos. Los datos internos (comision, neto) viven
 * en `order_financials`, que solo lee el personal: aunque un cliente consulte la API con su token, no
 * hay nada que filtrar.
 */
migrate(
	(app) => {
		const staff = '@request.auth.collectionName = "users"';
		const has = (code) => `@request.auth.role.permissions.code ?= "${code}"`;
		const staffAll = `${staff} && ${has('orders:read')}`;
		const isCustomer = '@request.auth.collectionName = "customers"';
		const timestamps = [
			{ type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
			{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
		];
		const lockedWrites = { createRule: null, updateRule: null, deleteRule: null };

		const customers = app.findCollectionByNameOrId('customers');
		const users = app.findCollectionByNameOrId('users');
		const variants = app.findCollectionByNameOrId('variants');

		// --- orders ---
		const orders = new Collection({
			type: 'base',
			name: 'orders',
			// el cliente ve sus pedidos; el personal con orders:read, todos; el cajero (pos:use), los que el vendio
			listRule: `(${isCustomer} && customer = @request.auth.id) || (${staffAll}) || (${staff} && ${has('pos:use')} && created_by = @request.auth.id)`,
			viewRule: `(${isCustomer} && customer = @request.auth.id) || (${staffAll}) || (${staff} && ${has('pos:use')} && created_by = @request.auth.id)`,
			...lockedWrites,
			fields: [
				{
					type: 'text',
					name: 'code',
					required: true,
					max: 32,
					pattern: '^[A-Z]-[0-9]{8}-[A-Z0-9]{4,8}$'
				},
				{ type: 'select', name: 'channel', required: true, maxSelect: 1, values: ['web', 'pos'] },
				{
					type: 'select',
					name: 'status',
					required: true,
					maxSelect: 1,
					values: ['pending', 'paid', 'completed', 'cancelled', 'refunded']
				},
				{
					type: 'select',
					name: 'payment_method',
					required: true,
					maxSelect: 1,
					values: ['cash', 'card_clip', 'transfer']
				},
				{
					type: 'relation',
					name: 'customer',
					collectionId: customers.id,
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'created_by',
					collectionId: users.id,
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 1
				},
				{ type: 'text', name: 'contact_name', max: 255 },
				{ type: 'text', name: 'contact_email', max: 255 },
				{ type: 'text', name: 'contact_phone', max: 30 },
				// montos en centavos; lo que ve el cliente (subtotal de lista, descuento, IVA y total)
				{ type: 'number', name: 'subtotal', onlyInt: true, min: 0 },
				{ type: 'number', name: 'discount', onlyInt: true, min: 0 },
				{ type: 'number', name: 'tax_total', onlyInt: true, min: 0 },
				{ type: 'number', name: 'total', onlyInt: true, min: 0 },
				// para consultar un pedido de invitado (/pedido/<codigo>?t=<token>)
				{ type: 'text', name: 'access_token', max: 64 },
				{ type: 'date', name: 'expires_at' },
				{ type: 'date', name: 'paid_at' },
				{ type: 'text', name: 'notes', max: 500 },
				...timestamps
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_orders_code ON orders (code)',
				'CREATE INDEX idx_orders_customer ON orders (customer, created)',
				'CREATE INDEX idx_orders_status ON orders (status, expires_at)',
				'CREATE INDEX idx_orders_created_by ON orders (created_by, created)',
				'CREATE INDEX idx_orders_contact_email ON orders (contact_email)'
			]
		});
		app.save(orders);

		// --- order_financials: solo personal (comision de Clip, neto, tasas usadas) ---
		const financials = new Collection({
			type: 'base',
			name: 'order_financials',
			listRule: staffAll,
			viewRule: staffAll,
			...lockedWrites,
			fields: [
				{
					type: 'relation',
					name: 'order',
					required: true,
					collectionId: orders.id,
					cascadeDelete: true,
					minSelect: 0,
					maxSelect: 1
				},
				{ type: 'number', name: 'base_total', onlyInt: true, min: 0 },
				{ type: 'number', name: 'fee_total', onlyInt: true, min: 0 },
				{ type: 'number', name: 'net_total', onlyInt: true },
				{ type: 'number', name: 'tax_rate_bp', onlyInt: true, min: 0 },
				{ type: 'number', name: 'fee_rate_bp', onlyInt: true, min: 0 },
				{ type: 'number', name: 'fee_fixed', onlyInt: true, min: 0 },
				{ type: 'bool', name: 'tax_applied' },
				{ type: 'bool', name: 'fee_applied' },
				{ type: 'bool', name: 'discount_non_card' },
				...timestamps
			],
			indexes: ['CREATE UNIQUE INDEX idx_order_financials_order ON order_financials (`order`)']
		});
		app.save(financials);

		// --- order_items: instantanea de lo vendido ---
		const itemRule = `(${isCustomer} && order.customer = @request.auth.id) || (${staffAll}) || (${staff} && ${has('pos:use')} && order.created_by = @request.auth.id)`;
		const items = new Collection({
			type: 'base',
			name: 'order_items',
			listRule: itemRule,
			viewRule: itemRule,
			...lockedWrites,
			fields: [
				{
					type: 'relation',
					name: 'order',
					required: true,
					collectionId: orders.id,
					cascadeDelete: true,
					minSelect: 0,
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'variant',
					collectionId: variants.id,
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 1
				},
				{ type: 'text', name: 'sku', max: 64 },
				{ type: 'text', name: 'product_name', max: 200 },
				{ type: 'text', name: 'variant_label', max: 200 },
				{ type: 'number', name: 'quantity', required: true, onlyInt: true, min: 1 },
				// precio base por unidad (el que se guarda en el catalogo) y lo que paga el cliente por la linea
				{ type: 'number', name: 'unit_base', onlyInt: true, min: 0 },
				{ type: 'number', name: 'line_total', onlyInt: true, min: 0 },
				...timestamps
			],
			indexes: ['CREATE INDEX idx_order_items_order ON order_items (`order`)']
		});
		app.save(items);

		// --- payments ---
		const payments = new Collection({
			type: 'base',
			name: 'payments',
			listRule: itemRule,
			viewRule: itemRule,
			...lockedWrites,
			fields: [
				{
					type: 'relation',
					name: 'order',
					required: true,
					collectionId: orders.id,
					cascadeDelete: true,
					minSelect: 0,
					maxSelect: 1
				},
				{
					type: 'select',
					name: 'method',
					required: true,
					maxSelect: 1,
					values: ['cash', 'card_clip', 'transfer']
				},
				{
					type: 'select',
					name: 'status',
					required: true,
					maxSelect: 1,
					values: ['pending', 'confirmed', 'failed', 'refunded']
				},
				{ type: 'number', name: 'amount', onlyInt: true, min: 0 },
				// Clip: id de la solicitud de pago y enlace; evento ya procesado (idempotencia del webhook)
				{ type: 'text', name: 'provider_ref', max: 128 },
				{ type: 'text', name: 'provider_url', max: 500 },
				{ type: 'text', name: 'provider_event_id', max: 128 },
				// comprobante de transferencia (privado: solo se sirve a traves de la app)
				{
					type: 'file',
					name: 'proof',
					maxSelect: 1,
					maxSize: 5242880,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
					protected: true
				},
				{
					type: 'relation',
					name: 'confirmed_by',
					collectionId: users.id,
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 1
				},
				{ type: 'date', name: 'confirmed_at' },
				...timestamps
			],
			indexes: [
				'CREATE INDEX idx_payments_order ON payments (`order`)',
				'CREATE INDEX idx_payments_provider_ref ON payments (provider_ref)',
				"CREATE UNIQUE INDEX idx_payments_event ON payments (provider_event_id) WHERE provider_event_id != ''"
			]
		});
		app.save(payments);

		// --- API batch: transacciones (pedido + stock de una sola vez) ---
		const settings = app.settings();
		settings.batch.enabled = true;
		settings.batch.maxRequests = 100;
		settings.batch.timeout = 5;
		app.save(settings);
	},
	(app) => {
		for (const name of ['payments', 'order_items', 'order_financials', 'orders']) {
			app.delete(app.findCollectionByNameOrId(name));
		}
		const settings = app.settings();
		settings.batch.enabled = false;
		app.save(settings);
	}
);
