import { fail } from '@sveltejs/kit';
import { SESSION } from '#core/auth.js';
import { mailActions, TOO_MANY, clientKey } from '#core/limits.js';
import { parseForm } from '#core/validate.js';
import { recoverSchema } from '#modules/customers/schema.js';

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const form = parseForm(recoverSchema, await request.formData());
		if (!form.ok) return fail(400, { errors: form.errors, values: form.values });
		if (mailActions.hit(`recover:${clientKey(getClientAddress)}`))
			return fail(429, { errors: { _: TOO_MANY }, values: form.values });

		// misma respuesta exista o no el correo: no se revela quien tiene cuenta
		await locals.customerPb
			.collection(SESSION.customer.collection)
			.requestPasswordReset(form.data.email)
			.catch(() => {});
		return { sent: true };
	}
};
