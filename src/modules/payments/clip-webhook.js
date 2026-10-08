export { tokenMatches } from '#core/tokens.js';

/**
 * Procesa un aviso de Clip. El aviso NO es de fiar por si solo (Clip no documenta una firma): solo
 * nos dice que solicitud de pago cambio, y el estado real se le CONSULTA a Clip con nuestras
 * credenciales. Asi nadie puede marcar un pedido como pagado fingiendo un webhook.
 *
 * Idempotente: confirmar un pedido ya pagado no hace nada, y el id del evento tiene indice unico.
 * Si Clip no responde, se lanza el error para que el endpoint conteste 5xx y Clip reintente.
 *
 * @returns {{ status: 'ignored' | 'unknown' | 'paid' | 'failed' | 'pending', changed?: boolean }}
 */
export async function processClipNotification({ payload, pb, clip, sales }) {
	const ref = typeof payload?.payment_request_id === 'string' ? payload.payment_request_id : '';
	if (!ref) return { status: 'ignored' };

	const payment = await pb
		.collection('payments')
		.getFirstListItem(pb.filter('provider_ref = {:ref}', { ref }))
		.catch((err) => (err?.status === 404 ? null : Promise.reject(err)));
	if (!payment) return { status: 'unknown' };

	const remote = await clip.getCheckout(ref);
	if (remote.status === 'paid') {
		const eventId = typeof payload.id === 'string' && payload.id ? payload.id : `${ref}:paid`;
		const out = await sales.confirmPayment(
			{ id: payment.order },
			{ eventId, paymentId: payment.id }
		);
		return { status: 'paid', changed: out.changed };
	}
	if (remote.status === 'failed') {
		const out = await sales.failPayment(payment.id);
		return { status: 'failed', changed: out.changed };
	}
	return { status: 'pending' };
}
