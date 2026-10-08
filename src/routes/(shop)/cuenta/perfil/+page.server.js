import { fail, redirect } from '@sveltejs/kit';
import { SESSION, authenticate, sessionCookieOptions } from '#core/auth.js';
import { DomainError } from '#core/errors.js';
import { setFlash } from '#core/flash.js';
import { mailActions, TOO_MANY } from '#core/limits.js';
import { fromPbError } from '#core/pb-errors.js';
import { routes } from '#core/routes.js';
import { parseForm } from '#core/validate.js';
import {
	emailChangeSchema,
	passwordChangeSchema,
	profileSchema
} from '#modules/customers/schema.js';

/** @type {import('./$types').PageServerLoad} */
export function load({ locals }) {
	return {
		profile: {
			name: locals.customer.name,
			phone: locals.customer.phone,
			email: locals.customer.email
		}
	};
}

const collection = (locals) => locals.customerPb.collection(SESSION.customer.collection);

/** @type {import('./$types').Actions} */
export const actions = {
	profile: async ({ request, locals, cookies }) => {
		const form = parseForm(profileSchema, await request.formData());
		if (!form.ok)
			return fail(400, { section: 'profile', errors: form.errors, values: form.values });
		await collection(locals).update(locals.customer.id, form.data);
		setFlash(cookies, { text: 'Datos guardados' });
		redirect(303, routes.profile());
	},

	email: async ({ request, locals, cookies, getClientAddress }) => {
		const form = parseForm(emailChangeSchema, await request.formData());
		if (!form.ok) return fail(400, { section: 'email', errors: form.errors, values: form.values });
		if (form.data.email === locals.customer.email.toLowerCase())
			return fail(400, {
				section: 'email',
				errors: { email: 'Ese ya es tu correo' },
				values: form.values
			});
		if (
			mailActions.hit(`email:${locals.customer.id}`) ||
			mailActions.hit(`email:${getClientAddress()}`)
		)
			return fail(429, { section: 'email', errors: { _: TOO_MANY }, values: form.values });
		try {
			await collection(locals).requestEmailChange(form.data.email);
		} catch (err) {
			const e = fromPbError(err);
			if (e instanceof DomainError)
				return fail(400, {
					section: 'email',
					errors: { email: 'No podemos usar ese correo' },
					values: form.values
				});
			throw err;
		}
		setFlash(cookies, { text: 'Te enviamos un correo a tu nuevo correo para confirmarlo.' });
		redirect(303, routes.profile());
	},

	password: async ({ request, locals, cookies }) => {
		const form = parseForm(passwordChangeSchema, await request.formData(), {
			omit: ['oldPassword', 'password', 'passwordConfirm']
		});
		if (!form.ok) return fail(400, { section: 'password', errors: form.errors });
		try {
			await collection(locals).update(locals.customer.id, form.data);
		} catch (err) {
			if (err?.status === 400)
				return fail(400, {
					section: 'password',
					errors: { oldPassword: 'Contraseña actual incorrecta' }
				});
			throw err;
		}
		// cambiar la contrasena invalida el token: se vuelve a entrar con la nueva
		const token = await authenticate(
			locals.customerPb,
			SESSION.customer.collection,
			locals.customer.email,
			form.data.password
		);
		if (token) cookies.set(SESSION.customer.cookie, token, sessionCookieOptions(token));
		setFlash(cookies, { text: 'Contraseña actualizada' });
		redirect(303, routes.profile());
	}
};
