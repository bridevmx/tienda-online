import { error, redirect } from '@sveltejs/kit';
import { DomainError } from '#core/errors.js';
import { recordId } from '#core/fields.js';
import { requirePermission } from '#core/guards.js';
import { setFlash } from '#core/flash.js';
import { routes } from '#core/routes.js';
import { formDataToObject } from '#core/validate.js';
import { loadBundle } from '#modules/sales/queries.js';
import {
	CHANNEL_LABEL,
	METHOD_LABEL,
	PAYMENT_STATUS,
	canTransition,
	orderStatusView
} from '#modules/sales/status.js';

async function load_(locals, url, id) {
	requirePermission(locals, url, 'orders:read');
	if (!recordId().safeParse(id).success) error(404, 'Venta no encontrada');
	const bundle = await loadBundle(locals.pb, { id });
	if (!bundle) error(404, 'Venta no encontrada');
	return bundle;
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url, params }) {
	const { order, items, payments, payment, financials } = await load_(locals, url, params.id);
	const can = (code) => locals.permissions.has(code);
	const pending = order.status === 'pending';

	return {
		order: {
			id: order.id,
			code: order.code,
			status: orderStatusView(order.status),
			statusId: order.status,
			channel: CHANNEL_LABEL[order.channel] ?? order.channel,
			method: METHOD_LABEL[order.payment_method] ?? order.payment_method,
			createdAt: order.created,
			paidAt: order.paid_at || null,
			expiresAt: pending ? order.expires_at || null : null,
			notes: order.notes,
			contact: { name: order.contact_name, email: order.contact_email, phone: order.contact_phone },
			customerId: order.customer || null,
			totals: {
				subtotal: order.subtotal,
				discount: order.discount,
				iva: order.tax_total,
				total: order.total
			}
		},
		items: items.map((i) => ({
			id: i.id,
			sku: i.sku,
			name: i.product_name,
			label: i.variant_label,
			qty: i.quantity,
			total: i.line_total
		})),
		payments: payments.map((p) => ({
			id: p.id,
			method: METHOD_LABEL[p.method] ?? p.method,
			status: p.status,
			statusLabel: PAYMENT_STATUS[p.status] ?? p.status,
			amount: p.amount,
			ref: p.provider_ref || null,
			receipt: p.receipt_no || null,
			note: p.provider_note || null,
			confirmedAt: p.confirmed_at || null,
			hasProof: !!p.proof
		})),
		currentPaymentId: payment?.id ?? null,
		finance: financials && {
			base: financials.base_total,
			fee: financials.fee_total,
			net: financials.net_total,
			rates: {
				iva: financials.tax_rate_bp / 100,
				clip: financials.fee_rate_bp / 100,
				fixed: financials.fee_fixed
			},
			taxApplied: financials.tax_applied,
			feeApplied: financials.fee_applied
		},
		canConfirm: can('payments:confirm') && pending && !!payment,
		canComplete: can('orders:update') && canTransition(order.status, 'completed'),
		canCancel: can('orders:cancel') && canTransition(order.status, 'cancelled'),
		canRefund: can('orders:refund') && canTransition(order.status, 'refunded'),
		proofHref: payments.some((p) => p.proof) ? routes.admin.saleProof(order.id) : null
	};
}

/** Ejecuta una operacion del servicio de ventas y vuelve al detalle con un aviso. */
async function perform({ locals, url, params, cookies }, permission, run, doneText) {
	requirePermission(locals, url, permission);
	if (!recordId().safeParse(params.id).success) error(404, 'Venta no encontrada');
	try {
		await run(await locals.sales());
		setFlash(cookies, { text: doneText });
	} catch (err) {
		if (!(err instanceof DomainError)) throw err;
		setFlash(cookies, { type: 'error', text: err.message });
	}
	redirect(303, routes.admin.sale(params.id));
}

/** @type {import('./$types').Actions} */
export const actions = {
	/** Confirmar el pago (p. ej. llego la transferencia). */
	confirm: (event) =>
		perform(
			event,
			'payments:confirm',
			(sales) => sales.confirmPayment({ id: event.params.id }, { by: event.locals.user.id }),
			'Pago confirmado'
		),

	complete: (event) =>
		perform(
			event,
			'orders:update',
			(sales) => sales.completeOrder({ id: event.params.id }),
			'Pedido completado'
		),

	cancel: async (event) => {
		const reason = String(
			formDataToObject(await event.request.clone().formData()).reason ?? ''
		).trim();
		return perform(
			event,
			'orders:cancel',
			(sales) =>
				sales.cancelOrder(
					{ id: event.params.id },
					{ reason: reason || 'Cancelado por el personal' }
				),
			'Pedido cancelado y stock repuesto'
		);
	},

	refund: async (event) => {
		const form = formDataToObject(await event.request.clone().formData());
		const restock = form.restock !== undefined && form.restock !== 'off';
		return perform(
			event,
			'orders:refund',
			(sales) => sales.refundOrder({ id: event.params.id }, { restock }),
			restock ? 'Reembolsado y stock repuesto' : 'Reembolsado'
		);
	}
};
