import { fail, redirect } from '@sveltejs/kit';
import { SESSION, authenticate, sessionCookieOptions } from '#core/auth.js';
import { loginFailures, TOO_MANY } from '#core/limits.js';
import { safeNext } from '#core/redirect.js';
import { routes } from '#core/routes.js';
import { parseForm } from '#core/validate.js';
import { loginSchema } from '#modules/access/schema.js';

const destination = (url) =>
	safeNext(url.searchParams.get('next'), { prefix: '/', fallback: routes.account() });

/** @type {import('./$types').PageServerLoad} */
export function load({ locals, url }) {
	if (locals.customer) redirect(303, destination(url));
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, cookies, url, getClientAddress }) => {
		const form = parseForm(loginSchema, await request.formData(), { omit: ['password'] });
		if (!form.ok) return fail(400, { errors: form.errors, values: form.values });

		const keys = [`login:${getClientAddress()}`, `login:${form.data.email.toLowerCase()}`];
		if (keys.some((k) => loginFailures.isLimited(k)))
			return fail(429, { errors: { _: TOO_MANY }, values: { email: form.data.email } });

		const token = await authenticate(
			locals.customerPb,
			SESSION.customer.collection,
			form.data.email,
			form.data.password
		);
		if (!token) {
			keys.forEach((k) => loginFailures.hit(k));
			return fail(400, {
				errors: { _: 'Correo o contraseña incorrectos' },
				values: { email: form.data.email }
			});
		}

		keys.forEach((k) => loginFailures.reset(k));
		cookies.set(SESSION.customer.cookie, token, sessionCookieOptions(token));
		redirect(303, destination(url));
	}
};
