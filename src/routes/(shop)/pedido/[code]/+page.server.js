import { error, fail, redirect } from '@sveltejs/kit';
import { DomainError } from '#core/errors.js';
import { setFlash } from '#core/flash.js';
import { routes } from '#core/routes.js';
import { processClipNotification } from '#modules/payments/clip-webhook.js';
import { canViewOrder } from '#modules/sales/access.js';
import { ORDER_CODE_PATTERN } from '#modules/sales/ids.js';
import { toCustomerOrder } from '#modules/sales/mappers.js';

const ALLOWED_PROOF = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_PROOF = 5 * 1024 * 1024;

/** Carga el pedido y comprueba que quien pregunta puede verlo; si no, "no existe" (no se revela). */
async function authorize({ params, url, locals }) {
	if (!ORDER_CODE_PATTERN.test(params.code)) error(404, 'Pedido no encontrado');
	const sales = await locals.sales();
	const token = url.searchParams.get('t');
	let bundle = await sales.bundle({ code: params.code });
	if (
		!bundle ||
		!canViewOrder({
			order: bundle.order,
			token,
			customerId: locals.customer?.id,
			permissions: locals.permissions
		})
	) {
		error(404, 'Pedido no encontrado');
	}
	return { sales, bundle, token };
}

/** Si el cliente regresa de pagar con tarjeta y el aviso aun no llega, se le pregunta a Clip. */
async function syncCardPayment({ locals, sales, bundle }) {
	const { order, payment } = bundle;
	if (
		order.status !== 'pending' ||
		payment?.method !== 'card_clip' ||
		payment.status !== 'pending' ||
		!payment.provider_ref
	)
		return bundle;
	try {
		await processClipNotification({
			payload: { payment_request_id: payment.provider_ref },
			pb: await locals.adminPb(),
			clip: locals.clip,
			sales
		});
		return (await sales.bundle({ id: order.id })) ?? bundle;
	} catch {
		return bundle; // sin conexion con Clip: se muestra el estado que tenemos
	}
}

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
	const { sales, token, bundle: first } = await authorize(event);
	const bundle = await syncCardPayment({ locals: event.locals, sales, bundle: first });
	const settings = await event.locals.settings();
	const order = toCustomerOrder(bundle, settings);

	const methods = [];
	if (bundle.order.status === 'pending' && bundle.order.channel === 'web') {
		if (bundle.order.payment_method !== 'card_clip' && event.locals.clip.isConfigured)
			methods.push({ id: 'card_clip', label: 'Pagar con tarjeta' });
		if (bundle.order.payment_method !== 'transfer' && settings['transfer.clabe'])
			methods.push({ id: 'transfer', label: 'Pagar por transferencia' });
	}
	return {
		order,
		token: token ?? '',
		methods,
		paymentError: event.url.searchParams.get('pago') === 'error'
	};
}

const back = (code, token) => routes.order(code, token || undefined);

/** @type {import('./$types').Actions} */
export const actions = {
	/** Cambia la forma de pago de un pedido pendiente (recalcula el total con las tasas del pedido). */
	change: async (event) => {
		const { sales, bundle, token } = await authorize(event);
		const method = String((await event.request.formData()).get('method') ?? '');
		try {
			const { action } = await sales.changePaymentMethod({ id: bundle.order.id }, method, {
				origin: event.url.origin
			});
			setFlash(event.cookies, { text: 'Cambiamos tu forma de pago' });
			if (action?.type === 'redirect') redirect(303, action.url, { external: true });
		} catch (err) {
			if (!(err instanceof DomainError)) throw err;
			return fail(400, { error: err.message });
		}
		redirect(303, back(bundle.order.code, token));
	},

	/** El cliente cancela su pedido pendiente (se libera el stock). */
	cancel: async (event) => {
		const { sales, bundle, token } = await authorize(event);
		try {
			await sales.cancelOrder(
				{ id: bundle.order.id },
				{ reason: 'Cancelado por el cliente', ifPending: true }
			);
			setFlash(event.cookies, { text: 'Pedido cancelado' });
		} catch (err) {
			if (!(err instanceof DomainError)) throw err;
			return fail(400, { error: err.message });
		}
		redirect(303, back(bundle.order.code, token));
	},

	/** Sube el comprobante de una transferencia pendiente (lo revisa el personal). */
	proof: async (event) => {
		const { bundle, token } = await authorize(event);
		const { order, payment } = bundle;
		if (order.status !== 'pending' || payment?.method !== 'transfer')
			return fail(400, { error: 'Este pedido no admite comprobante' });

		const file = (await event.request.formData()).get('proof');
		if (typeof file === 'string' || !file || file.size === 0)
			return fail(400, { error: 'Elige un archivo' });
		if (!ALLOWED_PROOF.has(file.type))
			return fail(400, { error: 'El comprobante debe ser una imagen (JPG, PNG o WebP) o un PDF' });
		if (file.size > MAX_PROOF) return fail(400, { error: 'El archivo pesa más de 5 MB' });

		const pb = await event.locals.adminPb();
		const body = new FormData();
		body.append('proof', file);
		await pb.collection('payments').update(payment.id, body);
		setFlash(event.cookies, { text: 'Recibimos tu comprobante. Lo revisaremos pronto.' });
		redirect(303, back(order.code, token));
	}
};
