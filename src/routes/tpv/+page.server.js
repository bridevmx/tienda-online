import { fail, redirect } from '@sveltejs/kit';
import { DomainError } from '#core/errors.js';
import { requirePermission } from '#core/guards.js';
import { pricingConfig } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { parseForm } from '#core/validate.js';
import { loadPosCatalog } from '#modules/pos/catalog.js';
import { chargeSchema } from '#modules/pos/schema.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	const settings = await locals.settings();
	const catalog = await loadPosCatalog(locals.pb);
	return {
		...catalog,
		// el TPV es solo para personal: puede ver la configuracion completa para calcular por metodo
		config: pricingConfig(settings),
		methods: {
			cash: true,
			transfer: !!settings['transfer.clabe'],
			card_clip: locals.clip.isConfigured
		},
		transfer: {
			beneficiary: settings['transfer.beneficiary'],
			bank: settings['transfer.bank'],
			clabe: settings['transfer.clabe']
		}
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	charge: async ({ request, locals, url }) => {
		requirePermission(locals, url, 'pos:use');
		const form = parseForm(chargeSchema, await request.formData());
		if (!form.ok) {
			const message = Object.values(form.errors)[0];
			return fail(400, { error: message });
		}
		const { lines, method, name, email, received } = form.data;

		let placed;
		try {
			placed = await (
				await locals.sales()
			).placeOrder({
				channel: 'pos',
				method,
				lines,
				contact: { name, email, phone: '' },
				createdBy: locals.user.id,
				// efectivo y transferencia se cobran al momento; la tarjeta espera a Clip
				confirmNow: method !== 'card_clip',
				origin: url.origin
			});
		} catch (err) {
			if (err instanceof DomainError) return fail(400, { error: err.message });
			throw err;
		}
		redirect(303, routes.pos.sale(placed.order.code, method === 'cash' ? received : 0));
	}
};
