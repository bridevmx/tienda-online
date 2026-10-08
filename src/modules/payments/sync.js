import { processClipNotification } from './clip-webhook.js';

/**
 * Si quien paga regresa de Clip (o la pantalla del TPV sigue esperando) y el aviso aun no llega,
 * se le pregunta a Clip el estado y se procesa igual que un webhook (idempotente).
 * Devuelve el pedido actualizado, o el mismo si no habia nada que consultar o Clip no responde.
 */
export async function syncCardPayment({ pb, clip, sales, bundle }) {
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
			pb,
			clip,
			sales
		});
		return (await sales.bundle({ id: order.id })) ?? bundle;
	} catch {
		return bundle; // sin conexion con Clip: se muestra el estado que tenemos
	}
}
