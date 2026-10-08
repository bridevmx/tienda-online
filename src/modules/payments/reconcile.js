import { verifyClipPayment } from './clip-webhook.js';

/** Los links de Clip duran 3 dias por defecto: no tiene caso preguntar por pagos mas viejos. */
const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Respaldo del webhook: Clip no documenta reintentos, asi que un aviso perdido dejaria un pedido
 * pagado como pendiente. Verifica con Clip los pagos con tarjeta pendientes (mas recientes primero).
 * Los ejecuta un script con cron (`npm run jobs:reconcile-payments`) y `jobs:expire-orders` antes de
 * cancelar nada. Un error con un pago no detiene a los demas. Los pagos con anomalia ya senalada
 * (`provider_note`) esperan revision manual y no se vuelven a consultar.
 */
export async function reconcileClipPayments({
	pb,
	clip,
	sales,
	now = () => new Date(),
	limit = 50,
	log = console
}) {
	const since = new Date(now().getTime() - WINDOW_MS).toISOString().replace('T', ' ');
	const pending = await pb.collection('payments').getList(1, limit, {
		filter: pb.filter(
			'method = "card_clip" && status = "pending" && provider_ref != "" && provider_note = "" && created > {:since}',
			{ since }
		),
		sort: '-created'
	});
	const result = { checked: 0, paid: 0, failed: 0, pending: 0, mismatch: 0, errors: [] };
	for (const payment of pending.items) {
		result.checked += 1;
		try {
			const { status } = await verifyClipPayment({
				linkId: payment.provider_ref,
				pb,
				clip,
				sales,
				log
			});
			if (status in result) result[status] += 1;
		} catch (err) {
			result.errors.push({ payment: payment.id, error: err?.message ?? String(err) });
		}
	}
	return result;
}
