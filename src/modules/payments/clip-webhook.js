import { isClipId } from './clip.js';

export { tokenMatches } from '#core/tokens.js';

/**
 * Verifica un pago con tarjeta preguntandole a Clip (GET /v2/checkout/{id}). Es el UNICO camino por
 * el que un pago de Clip se da por recibido: el webhook, la pagina de retorno y el reconciliador solo
 * lo disparan; nunca se confia en su contenido.
 *
 * Un pago `paid` se acepta solo si Clip lo reporta COMPLETADO y ademas coincide TODO con lo nuestro:
 * la referencia firmada, el monto del pago, la moneda MXN, y existe `receipt_no`. Si algo no coincide,
 * el pedido NO se cancela (el cliente si pago): queda una nota en el pago y un error en el log para
 * revision manual. Sin `receipt_no` todavia, se trata como pendiente (se reintenta).
 *
 * Idempotente: confirmar un pedido ya pagado no hace nada; `provider_event_id` y `receipt_no` tienen
 * indice unico.
 *
 * @returns {{ status: 'unknown' | 'paid' | 'failed' | 'pending' | 'mismatch', changed?: boolean }}
 */
export async function verifyClipPayment({ linkId, pb, clip, sales, log = console }) {
	if (!isClipId(linkId)) return { status: 'unknown' };

	// solo se consulta a Clip por solicitudes que existen en nuestra base
	const payment = await pb
		.collection('payments')
		.getFirstListItem(pb.filter('provider_ref = {:ref}', { ref: linkId }))
		.catch((err) => (err?.status === 404 ? null : Promise.reject(err)));
	if (!payment) return { status: 'unknown' };
	// ya conciliado (o devuelto): no hay nada que preguntar
	if (payment.status === 'confirmed' || payment.status === 'refunded') {
		return { status: 'paid', changed: false };
	}

	const remote = await clip.getCheckout(linkId);

	if (remote.status === 'failed') {
		const out = await sales.failPayment(payment.id);
		return { status: 'failed', changed: out.changed };
	}
	if (remote.status !== 'paid') return { status: 'pending' };

	// ---- Clip dice COMPLETADO: se valida contra NUESTROS datos antes de dar nada por pagado
	const problems = [];
	if (
		clip.parseReference(remote.reference) !== payment.id ||
		remote.reference !== payment.reference
	)
		problems.push(`referencia distinta (${remote.reference ?? 'ninguna'})`);
	if (remote.amountCents !== payment.amount)
		problems.push(`monto distinto (Clip ${remote.amountCents}, pedido ${payment.amount} centavos)`);
	if (remote.currency !== 'MXN') problems.push(`moneda distinta (${remote.currency ?? 'ninguna'})`);
	if (problems.length) {
		const note = `Clip reporta el pago completado pero no coincide: ${problems.join('; ')}. Revisar a mano.`;
		log.error(`[clip] pago ${payment.id} (${linkId}): ${note}`);
		await sales.notePayment(payment.id, note);
		return { status: 'mismatch' };
	}
	// el recibo aparece solo al completarse; si aun no se refleja, se reintenta despues
	if (!remote.receiptNo) return { status: 'pending' };

	// un recibo no puede acreditar dos pedidos
	const reused = await pb.collection('payments').getList(1, 1, {
		filter: pb.filter('receipt_no = {:r} && id != {:id}', { r: remote.receiptNo, id: payment.id }),
		fields: 'id'
	});
	if (reused.totalItems > 0) {
		const note = `El recibo ${remote.receiptNo} de Clip ya acredito otro pago. Revisar a mano.`;
		log.error(`[clip] pago ${payment.id} (${linkId}): ${note}`);
		await sales.notePayment(payment.id, note);
		return { status: 'mismatch' };
	}

	const out = await sales.confirmPayment(
		{ id: payment.order },
		{ eventId: linkId, paymentId: payment.id, receiptNo: remote.receiptNo }
	);
	return { status: 'paid', changed: out.changed };
}

/**
 * Procesa el aviso de Clip: `{ id, origin, event_type }`. Solo se usa `id` (y solo si es un UUID):
 * lo demas es informacion sin autenticar.
 */
export function processClipNotification({ payload, ...deps }) {
	return verifyClipPayment({ linkId: payload?.id, ...deps });
}
