import { redirect } from '@sveltejs/kit';
import { SESSION } from '#core/auth.js';
import { routes } from '#core/routes.js';

/** @type {import('./$types').PageServerLoad} */
export function load() {
	redirect(303, routes.admin.home());
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: ({ cookies }) => {
		cookies.delete(SESSION.staff.cookie, { path: '/' });
		redirect(303, routes.admin.login());
	}
};
