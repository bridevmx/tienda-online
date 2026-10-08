import { error, redirect } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { setFlash } from '#core/flash.js';
import { requirePermission } from '#core/guards.js';
import { routes } from '#core/routes.js';
import { syncCardPayment } from '#modules/payments/sync.js';
import { ORDER_CODE_PATTERN } from '#modules/sales/ids.js';
import { toCustomerOrder } from '#modules/sales/mappers.js';

/** Un ticket del TPV lo ve quien lo vendio, o quien puede ver todas las ventas. */
async function authorize({ params, locals, url }) {
	const user = requirePermission(locals, url, 'pos:use');
	if (!ORDER_CODE_PATTERN.test(params.code)) error(404, 'Venta no encontrada');
	const sales = await locals.sales();
	const bundle = await sales.bundle({ code: params.code });
	const mine = bundle?.order.created_by === user.id;
	if (!bundle || bundle.order.channel !== 'pos' || !(mine || locals.permissions.has('orders:read')))
		error(404, 'Venta no encontrada');
	return { sales, bundle, mine };
}

/** @type {import('./$types').PageServerLoad} */
export async function load(event) {
	const { sales, bundle: first, mine } = await authorize(event);
	const bundle = await syncCardPayment({
		pb: await event.locals.adminPb(),
		clip: event.locals.clip,
		sales,
		bundle: first
	});
	const settings = await event.locals.settings();
	const order = toCustomerOrder(bundle, settings);
	const received = Math.max(0, parseInt(event.url.searchParams.get('recibido') ?? '0', 10) || 0);

	// QR del link de pago de Clip mientras se espera (el cliente lo escanea con su telefono)
	const payUrl = order.payment?.payUrl ?? null;
	const qr = payUrl ? await QRCode.toString(payUrl, { type: 'svg', margin: 1, width: 224 }) : null;

	return {
		order,
		qr,
		waiting: order.status === 'pending' && order.method === 'card_clip',
		cashier: mine ? event.locals.user.name : '',
		change:
			order.method === 'cash' && received >= order.totals.total
				? received - order.totals.total
				: null,
		received: order.method === 'cash' && received >= order.totals.total ? received : null
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	/** Cancelar un cobro con tarjeta que aun no se paga (libera el stock). */
	cancel: async (event) => {
		const { sales, bundle } = await authorize(event);
		if (bundle.order.status === 'pending') {
			await sales.cancelOrder(
				{ id: bundle.order.id },
				{ reason: 'Cancelado en el TPV', ifPending: true }
			);
			setFlash(event.cookies, { text: 'Cobro cancelado' });
		}
		redirect(303, routes.pos.home());
	}
};
