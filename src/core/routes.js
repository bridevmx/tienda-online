/**
 * Registro unico de rutas. Nunca se escriben rutas a mano en componentes ni acciones:
 * se usan estos constructores. URLs visibles en espanol, codigo en ingles.
 */
const enc = encodeURIComponent;

export const routes = {
	home: () => '/',

	// tienda
	products: () => '/productos',
	product: (slug) => `/productos/${enc(slug)}`,
	category: (slug) => `/categorias/${enc(slug)}`,
	cart: () => '/carrito',
	checkout: () => '/checkout',
	/** Consulta de pedido de invitado: el token evita enumerar codigos. */
	order: (code, token) => `/pedido/${enc(code)}${token ? `?t=${enc(token)}` : ''}`,

	// clientes (colecciones `customers`)
	login: () => '/entrar',
	logout: () => '/salir',
	register: () => '/registro',
	recover: () => '/recuperar',
	verify: () => '/verificar',
	account: () => '/cuenta',
	profile: () => '/cuenta/perfil',

	// personal (colecciones `users`)
	admin: {
		login: () => '/admin/entrar',
		logout: () => '/admin/salir',
		home: () => '/admin',
		list: (resource) => `/admin/${enc(resource)}`,
		create: (resource) => `/admin/${enc(resource)}/nuevo`,
		edit: (resource, id) => `/admin/${enc(resource)}/${enc(id)}`,
		sales: () => '/admin/ventas',
		sale: (id) => `/admin/ventas/${enc(id)}`,
		settings: () => '/admin/ajustes'
	},

	// punto de venta
	pos: {
		home: () => '/tpv',
		sales: () => '/tpv/ventas'
	},

	/** Archivo de un registro de PocketBase servido por la app (el navegador nunca ve PocketBase). */
	media: (collection, id, filename, thumb) =>
		`/media/${enc(collection)}/${enc(id)}/${enc(filename)}${thumb ? `?thumb=${enc(thumb)}` : ''}`,

	// unicos endpoints /api: webhooks
	webhooks: {
		clip: () => '/api/webhooks/clip'
	}
};
