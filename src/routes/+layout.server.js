/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals }) {
	return { theme: locals.theme };
}
