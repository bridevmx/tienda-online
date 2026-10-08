/// <reference path="../pb_data/types.d.ts" />
/**
 * Fase 4: ajustes de la tienda como clave-valor (IVA, comision de Clip, vencimiento de pedidos,
 * datos de transferencia...). El valor es texto; los tipos y valores por defecto viven en el
 * registro del modulo (src/modules/settings/registry.js), que valida con Zod al guardar.
 *
 * Solo el personal con permiso las lee o edita: incluyen la comision de Clip, que el cliente no ve.
 * El servidor las lee para calcular precios con `locals.adminPb()` (ver core/pb-admin.js).
 */
migrate(
	(app) => {
		const staff = '@request.auth.collectionName = "users"';
		const has = (code) => `@request.auth.role.permissions.code ?= "${code}"`;
		const settings = new Collection({
			type: 'base',
			name: 'settings',
			listRule: `${staff} && ${has('settings:read')}`,
			viewRule: `${staff} && ${has('settings:read')}`,
			createRule: `${staff} && ${has('settings:update')}`,
			updateRule: `${staff} && ${has('settings:update')}`,
			deleteRule: null,
			fields: [
				{ type: 'text', name: 'key', required: true, max: 100, pattern: '^[a-z][a-z0-9_.]*$' },
				{ type: 'text', name: 'value', max: 2000 },
				{ type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
				{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE UNIQUE INDEX idx_settings_key ON settings (key)']
		});
		app.save(settings);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('settings'));
	}
);
