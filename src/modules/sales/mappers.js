import { routes } from '#core/routes.js';
import { orderStatusView, METHOD_LABEL, PAYMENT_STATUS } from './status.js';

/**
 * Pedido -> lo que puede ver el CLIENTE. Parte solo de campos de cliente (nunca de `financials`) y
 * arma explicitamente cada propiedad: nada se copia "por si acaso".
 *
 * @param bundle    resultado de loadBundle (se ignora `financials`)
 * @param settings  ajustes tipados (datos de transferencia)
 */
export function toCustomerOrder(bundle, settings) {
	const { order, items, payment } = bundle;
	const pendingTransfer = order.status === 'pending' && order.payment_method === 'transfer';
	const pendingCard = order.status === 'pending' && order.payment_method === 'card_clip';
	const status = orderStatusView(order.status);

	return {
		code: order.code,
		channel: order.channel,
		status: order.status,
		statusLabel: status.label,
		statusBadge: status.badge,
		createdAt: order.created,
		expiresAt: order.status === 'pending' ? order.expires_at || null : null,
		method: order.payment_method,
		methodLabel: METHOD_LABEL[order.payment_method] ?? order.payment_method,
		items: items.map((i) => ({
			name: i.product_name,
			label: i.variant_label,
			qty: i.quantity,
			total: i.line_total
		})),
		totals: {
			subtotal: order.subtotal,
			discount: order.discount,
			iva: order.tax_total,
			total: order.total
		},
		payment: payment && {
			status: payment.status,
			statusLabel: PAYMENT_STATUS[payment.status] ?? payment.status,
			// el enlace de pago solo mientras se puede pagar
			payUrl: pendingCard && payment.status === 'pending' ? payment.provider_url || null : null,
			hasProof: !!payment.proof
		},
		transfer: pendingTransfer
			? {
					beneficiary: settings['transfer.beneficiary'],
					bank: settings['transfer.bank'],
					clabe: settings['transfer.clabe'],
					instructions: settings['transfer.instructions'],
					reference: order.code
				}
			: null,
		href: routes.order(order.code)
	};
}
