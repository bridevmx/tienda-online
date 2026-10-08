/// <reference path="../pb_data/types.d.ts" />
/**
 * Fase 2: catalogo. categories, products, options, option_values y variants.
 * Sin campos JSON: las opciones de una variante (Talla M, Color Rojo) son una relacion multiple a
 * `option_values`. El precio esta en centavos (entero) y vive en la variante: un producto simple
 * tiene una unica variante sin valores.
 *
 * Lectura publica solo de lo activo; el personal con permiso de lectura ve tambien lo inactivo.
 * Las reglas de integridad que PocketBase no puede expresar (una variante no repite opcion, todas
 * las variantes de un producto usan las mismas opciones) viven en SvelteKit
 * (src/modules/catalog); aqui van solo las que la base puede garantizar.
 */
migrate(
	(app) => {
		const staff = '@request.auth.collectionName = "users"';
		const has = (code) => `@request.auth.role.permissions.code ?= "${code}"`;
		const staffCan = (code) => `${staff} && ${has(code)}`;
		const publicOrStaff = (visible, resource) => `${visible} || (${staffCan(`${resource}:read`)})`;
		const timestamps = [
			{ type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
			{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
		];
		const slugPattern = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
		const writeRules = (resource, extra = {}) => ({
			createRule: staffCan(`${resource}:create`),
			updateRule: staffCan(`${resource}:update`),
			deleteRule: extra.deleteRule ?? staffCan(`${resource}:delete`)
		});

		// --- categories (arbol de un nivel de autorreferencia) ---
		const categories = new Collection({
			type: 'base',
			name: 'categories',
			listRule: publicOrStaff('active = true', 'categories'),
			viewRule: publicOrStaff('active = true', 'categories'),
			...writeRules('categories'),
			fields: [
				{ type: 'text', name: 'name', required: true, max: 120 },
				{ type: 'text', name: 'slug', required: true, max: 140, pattern: slugPattern },
				{
					type: 'file',
					name: 'image',
					maxSelect: 1,
					maxSize: 5242880,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
					thumbs: ['160x160', '480x480']
				},
				{ type: 'number', name: 'sort', onlyInt: true, min: 0 },
				{ type: 'bool', name: 'active' },
				...timestamps
			],
			indexes: ['CREATE UNIQUE INDEX idx_categories_slug ON categories (slug)']
		});
		app.save(categories);
		// autorreferencia: se agrega despues de que la coleccion ya tiene id
		categories.fields.add(
			new RelationField({
				name: 'parent',
				collectionId: categories.id,
				cascadeDelete: false,
				minSelect: 0,
				maxSelect: 1
			})
		);
		// una categoria con subcategorias no se borra (con productos ya lo impide la relacion requerida);
		// la regla usa el campo `parent`, por eso se asigna ahora
		categories.deleteRule = `${staffCan('categories:delete')} && categories_via_parent.id = ""`;
		app.save(categories);

		// --- products ---
		const products = new Collection({
			type: 'base',
			name: 'products',
			listRule: publicOrStaff('active = true', 'products'),
			viewRule: publicOrStaff('active = true', 'products'),
			...writeRules('products'),
			fields: [
				{ type: 'text', name: 'name', required: true, max: 200 },
				{ type: 'text', name: 'slug', required: true, max: 220, pattern: slugPattern },
				{ type: 'editor', name: 'description', maxSize: 100000, convertURLs: false },
				{
					type: 'relation',
					name: 'category',
					required: true,
					collectionId: categories.id,
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 1
				},
				{
					type: 'file',
					name: 'images',
					maxSelect: 10,
					maxSize: 5242880,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
					thumbs: ['160x160', '480x480', '960x0']
				},
				{ type: 'bool', name: 'active' },
				...timestamps
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_products_slug ON products (slug)',
				'CREATE INDEX idx_products_category ON products (category)'
			]
		});
		app.save(products);

		// --- options (Talla, Color...) y sus valores ---
		const options = new Collection({
			type: 'base',
			name: 'options',
			listRule: '',
			viewRule: '',
			...writeRules('options'),
			fields: [
				{ type: 'text', name: 'name', required: true, max: 80 },
				{ type: 'number', name: 'sort', onlyInt: true, min: 0 },
				...timestamps
			],
			indexes: ['CREATE UNIQUE INDEX idx_options_name ON options (name)']
		});
		app.save(options);

		const optionValues = new Collection({
			type: 'base',
			name: 'option_values',
			listRule: '',
			viewRule: '',
			...writeRules('options'),
			fields: [
				{
					type: 'relation',
					name: 'option',
					required: true,
					collectionId: options.id,
					// una opcion con valores no se puede borrar: primero se borran sus valores
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 1
				},
				{ type: 'text', name: 'value', required: true, max: 80 },
				{ type: 'number', name: 'sort', onlyInt: true, min: 0 },
				...timestamps
			],
			indexes: ['CREATE UNIQUE INDEX idx_option_values_unique ON option_values (option, value)']
		});
		app.save(optionValues);

		// --- variants: la unidad que se vende ---
		const variants = new Collection({
			type: 'base',
			name: 'variants',
			listRule: publicOrStaff('active = true && product.active = true', 'variants'),
			viewRule: publicOrStaff('active = true && product.active = true', 'variants'),
			...writeRules('variants'),
			fields: [
				{
					type: 'relation',
					name: 'product',
					required: true,
					collectionId: products.id,
					cascadeDelete: true,
					minSelect: 0,
					maxSelect: 1
				},
				{ type: 'text', name: 'sku', required: true, max: 64, pattern: '^[A-Z0-9][A-Z0-9._-]*$' },
				{ type: 'text', name: 'barcode', max: 64 },
				// centavos MXN y unidades, enteros >= 0. No son `required`: en PocketBase un numero
				// requerido rechaza el 0 (lo trata como vacio) y un stock de 0 es un valor valido.
				{ type: 'number', name: 'price', onlyInt: true, min: 0 },
				{ type: 'number', name: 'stock', onlyInt: true, min: 0 },
				{
					type: 'file',
					name: 'image',
					maxSelect: 1,
					maxSize: 5242880,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
					thumbs: ['160x160', '480x480']
				},
				{ type: 'bool', name: 'active' },
				{
					type: 'relation',
					name: 'values',
					collectionId: optionValues.id,
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 20
				},
				...timestamps
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_variants_sku ON variants (sku)',
				"CREATE UNIQUE INDEX idx_variants_barcode ON variants (barcode) WHERE barcode != ''",
				'CREATE INDEX idx_variants_product ON variants (product)'
			]
		});
		app.save(variants);

		// un valor usado por alguna variante no se borra (la variante perderia una de sus opciones);
		// la regla referencia a `variants`, por eso se asigna una vez que existe
		optionValues.deleteRule = `${staffCan('options:delete')} && variants_via_values.id = ""`;
		app.save(optionValues);
	},
	(app) => {
		for (const name of ['variants', 'option_values', 'options', 'products', 'categories']) {
			app.delete(app.findCollectionByNameOrId(name));
		}
	}
);
