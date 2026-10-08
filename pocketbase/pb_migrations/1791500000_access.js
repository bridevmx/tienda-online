/// <reference path="../pb_data/types.d.ts" />
/**
 * Fase 1: acceso. Colecciones `permissions`, `roles` y `customers`, y ajustes a `users` (personal).
 * Solo esquema y reglas de API; sin logica de negocio (esa vive en SvelteKit).
 *
 * Las reglas recorren la relacion rol -> permisos del usuario autenticado:
 *   @request.auth.role.permissions.code ?= "products:update"
 * Los codigos de permiso los declaran los modulos (src/modules/*) y los sincroniza
 * `npm run permissions:sync`.
 */
migrate(
	(app) => {
		const staff = '@request.auth.collectionName = "users"';
		const has = (code) => `@request.auth.role.permissions.code ?= "${code}"`;
		const timestamps = [
			{ type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
			{ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
		];

		// --- permissions: catalogo de permisos (solo lo escribe el superusuario via sync) ---
		const permissions = new Collection({
			type: 'base',
			name: 'permissions',
			listRule: staff,
			viewRule: staff,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{
					type: 'text',
					name: 'code',
					required: true,
					max: 100,
					pattern: '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$'
				},
				{ type: 'text', name: 'module', required: true, max: 50 },
				{ type: 'text', name: 'description', max: 255 },
				...timestamps
			],
			indexes: ['CREATE UNIQUE INDEX idx_permissions_code ON permissions (code)']
		});
		app.save(permissions);

		// --- roles ---
		const roles = new Collection({
			type: 'base',
			name: 'roles',
			listRule: `${staff} && ${has('roles:read')}`,
			// cada usuario puede leer su propio rol (para cargar sus permisos)
			viewRule: `${staff} && (id = @request.auth.role || ${has('roles:read')})`,
			createRule: `${staff} && ${has('roles:create')} && (@request.body.system:isset = false || @request.body.system = false)`,
			// los roles `system` (admin) no se editan ni se borran desde la app
			updateRule: `${staff} && ${has('roles:update')} && system = false && (@request.body.system:isset = false || @request.body.system = false)`,
			deleteRule: `${staff} && ${has('roles:delete')} && system = false`,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 100 },
				{ type: 'text', name: 'slug', required: true, max: 50, pattern: '^[a-z][a-z0-9_-]*$' },
				{ type: 'bool', name: 'system' },
				{
					type: 'relation',
					name: 'permissions',
					collectionId: permissions.id,
					cascadeDelete: false,
					minSelect: 0,
					maxSelect: 500
				},
				...timestamps
			],
			indexes: ['CREATE UNIQUE INDEX idx_roles_slug ON roles (slug)']
		});
		app.save(roles);

		// --- users: personal de la tienda (no hay registro publico) ---
		const users = app.findCollectionByNameOrId('users');
		users.fields.add(
			new RelationField({
				name: 'role',
				collectionId: roles.id,
				cascadeDelete: false,
				minSelect: 0,
				maxSelect: 1
			})
		);
		users.fields.add(new BoolField({ name: 'active' }));
		users.listRule = `${staff} && (id = @request.auth.id || ${has('users:read')})`;
		users.viewRule = users.listRule;
		users.createRule = `${staff} && ${has('users:create')}`;
		// cada quien edita su perfil sin tocar rol ni estado; cambiar rol/estado exige users:update
		// y nadie puede cambiarse a si mismo (evita escalar privilegios)
		users.updateRule =
			`${staff} && ((id = @request.auth.id && @request.body.role:isset = false && @request.body.active:isset = false)` +
			` || (${has('users:update')} && id != @request.auth.id))`;
		users.deleteRule = `${staff} && ${has('users:delete')} && id != @request.auth.id`;
		users.authRule = 'active = true';
		users.authToken.duration = 43200; // 12 h
		app.save(users);

		// --- customers: compradores de la tienda, autenticacion aparte del personal ---
		const customers = new Collection({
			type: 'auth',
			name: 'customers',
			listRule: `id = @request.auth.id || (${staff} && ${has('customers:read')})`,
			viewRule: `id = @request.auth.id || (${staff} && ${has('customers:read')})`,
			// el registro es abierto: un cliente no tiene ningun privilegio fuera de sus propios datos
			createRule: '',
			updateRule: `id = @request.auth.id || (${staff} && ${has('customers:update')})`,
			deleteRule: `${staff} && ${has('customers:delete')}`,
			fields: [
				{ type: 'text', name: 'name', required: true, max: 255 },
				{ type: 'text', name: 'phone', max: 30 },
				...timestamps
			],
			passwordAuth: { enabled: true, identityFields: ['email'] },
			authToken: { duration: 2592000 }, // 30 dias
			indexes: []
		});
		app.save(customers);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('customers'));

		const users = app.findCollectionByNameOrId('users');
		users.fields.removeByName('role');
		users.fields.removeByName('active');
		users.listRule = 'id = @request.auth.id';
		users.viewRule = 'id = @request.auth.id';
		users.createRule = '';
		users.updateRule = 'id = @request.auth.id';
		users.deleteRule = 'id = @request.auth.id';
		users.authRule = '';
		users.authToken.duration = 432000;
		app.save(users);

		app.delete(app.findCollectionByNameOrId('roles'));
		app.delete(app.findCollectionByNameOrId('permissions'));
	}
);
