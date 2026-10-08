import { takeFlash } from '#core/flash.js';

/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals, cookies }) {
	return { theme: locals.theme, flash: takeFlash(cookies) };
}
