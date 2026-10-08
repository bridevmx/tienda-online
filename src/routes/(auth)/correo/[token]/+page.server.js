import { fail, redirect } from '@sveltejs/kit';
import { SESSION } from '#core/auth.js';
import { setFlash } from '#core/flash.js';
import { routes } from '#core/routes.js';
import { parseForm } from '#core/validate.js';
import { confirmEmailSchema } from '#modules/customers/schema.js';

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, params, locals, cookies }) => {
		const form = parseForm(confirmEmailSchema, await request.formData(), { omit: ['password'] });
		if (!form.ok) return fail(400, { errors: form.errors });
		try {
			await locals.customerPb
				.collection(SESSION.customer.collection)
				.confirmEmailChange(params.token, form.data.password);
		} catch (err) {
			if (err?.status === 400)
				return fail(400, { errors: { password: 'Contraseña incorrecta o enlace vencido' } });
			throw err;
		}
		cookies.delete(SESSION.customer.cookie, { path: '/' });
		setFlash(cookies, { text: 'Correo actualizado. Entra con tu nuevo correo.' });
		redirect(303, routes.login());
	}
};
