import { takeFlash } from '#core/flash.js';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals, cookies }) {
	let storeName = 'Tienda online';
	try {
		storeName = (await locals.settings())['store.name'];
	} catch {
		// sin credenciales de superusuario no hay ajustes: se usa el nombre por defecto
	}
	return { theme: locals.theme, flash: takeFlash(cookies), storeName };
}
