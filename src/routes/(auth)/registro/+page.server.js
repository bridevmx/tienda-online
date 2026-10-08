import { fail, redirect } from '@sveltejs/kit';
import { SESSION, authenticate, sessionCookieOptions } from '#core/auth.js';
import { setFlash } from '#core/flash.js';
import { mailActions, TOO_MANY, clientKey } from '#core/limits.js';
import { fromPbError } from '#core/pb-errors.js';
import { safeNext } from '#core/redirect.js';
import { routes } from '#core/routes.js';
import { parseForm } from '#core/validate.js';
import { DomainError } from '#core/errors.js';
import { registerSchema } from '#modules/customers/schema.js';

const OMIT = ['password', 'passwordConfirm'];

/** @type {import('./$types').PageServerLoad} */
export function load({ locals }) {
	if (locals.customer) redirect(303, routes.account());
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, cookies, url, getClientAddress }) => {
		const form = parseForm(registerSchema, await request.formData(), { omit: OMIT });
		if (!form.ok) return fail(400, { errors: form.errors, values: form.values });
		if (mailActions.hit(`register:${clientKey(getClientAddress)}`))
			return fail(429, { errors: { _: TOO_MANY }, values: form.values });

		const { name, email, phone, password } = form.data;
		const customers = locals.customerPb.collection(SESSION.customer.collection);
		try {
			await customers.create({ name, email, phone, password, passwordConfirm: password });
		} catch (err) {
			const e = fromPbError(err);
			if (e instanceof DomainError)
				return fail(400, {
					errors: {
						[e.field === 'email' ? 'email' : '_']:
							e.field === 'email' ? 'Ya existe una cuenta con ese correo' : e.message
					},
					values: { name, email, phone }
				});
			throw err;
		}
		// el correo de verificacion es un extra: si falla el envio, la cuenta ya existe
		await customers.requestVerification(email).catch(() => {});

		const token = await authenticate(
			locals.customerPb,
			SESSION.customer.collection,
			email,
			password
		);
		if (token) cookies.set(SESSION.customer.cookie, token, sessionCookieOptions(token));
		setFlash(cookies, { text: 'Cuenta creada. Te enviamos un correo para verificarla.' });
		redirect(
			303,
			safeNext(url.searchParams.get('next'), { prefix: '/', fallback: routes.account() })
		);
	}
};
