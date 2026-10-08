import { fail, redirect } from '@sveltejs/kit';
import { SESSION } from '#core/auth.js';
import { setFlash } from '#core/flash.js';
import { routes } from '#core/routes.js';
import { parseForm } from '#core/validate.js';
import { resetSchema } from '#modules/customers/schema.js';

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, params, locals, cookies }) => {
		const form = parseForm(resetSchema, await request.formData(), {
			omit: ['password', 'passwordConfirm']
		});
		if (!form.ok) return fail(400, { errors: form.errors });
		try {
			await locals.customerPb
				.collection(SESSION.customer.collection)
				.confirmPasswordReset(params.token, form.data.password, form.data.passwordConfirm);
		} catch (err) {
			if (err?.status === 400)
				return fail(400, {
					errors: { _: 'El enlace no es válido o ya venció. Pide uno nuevo.' },
					expired: true
				});
			throw err;
		}
		// el cambio cierra las sesiones abiertas de esa cuenta
		cookies.delete(SESSION.customer.cookie, { path: '/' });
		setFlash(cookies, { text: 'Contraseña actualizada. Ya puedes entrar.' });
		redirect(303, routes.login());
	}
};
