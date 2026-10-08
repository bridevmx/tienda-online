import { createRateLimiter } from '#core/rate-limit.js';
import { verifyClipPayment } from './clip-webhook.js';

// quien recarga la pagina de un pedido no debe poder agotar el limite de peticiones de Clip
const recentlyChecked = createRateLimiter({ max: 1, windowMs: 2000 });

/**
 * Si quien paga regresa de Clip (o la pantalla del TPV sigue esperando) y el aviso aun no llega,
 * se le pregunta a Clip el estado y se procesa igual que un webhook (idempotente). La URL de retorno
 * NO prueba nada: solo dispara esta verificacion. Devuelve el pedido actualizado, o el mismo si no
 * habia nada que consultar o Clip no responde.
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
	// solo cuentan las consultas que SI se hacen: un sondeo constante no debe extender la espera
	if (recentlyChecked.isLimited(payment.id)) return bundle;
	recentlyChecked.hit(payment.id);
	try {
		await verifyClipPayment({ linkId: payment.provider_ref, pb, clip, sales });
		return (await sales.bundle({ id: order.id })) ?? bundle;
	} catch {
		return bundle; // sin conexion con Clip: se muestra el estado que tenemos
	}
}
