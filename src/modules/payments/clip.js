/**
 * Cliente de la API de Clip (links de pago del Checkout Redireccionado).
 * Fuente: developer.clip.mx (createnewpaymentlink, checkpaymentlinkstatus, webhookshxo). Ver docs/CLIP.md.
 *
 *   POST {base}/v2/checkout        crea el link (amount, currency, purchase_description, redirection_url
 *                                   {success, error, default}, metadata.external_reference, webhook_url,
 *                                   custom_payment_options). Responde payment_request_id (UUID),
 *                                   payment_request_url, status y qr_image_url.
 *   GET  {base}/v2/checkout/{id}   estado: status, amount, currency, metadata.external_reference,
 *                                   payment_request_id y, SOLO si esta completado, receipt_no.
 *
 * Estados: CHECKOUT_CREATED | CHECKOUT_PENDING (esperando) | CHECKOUT_CANCELLED (5 intentos fallidos) |
 * CHECKOUT_EXPIRED | CHECKOUT_COMPLETED (liquidado). El webhook solo trae { id, origin, event_type } y
 * no tiene firma: nunca se usa su contenido; se consulta el estado con GET (ver clip-webhook.js).
 */
import { makePaymentReference, parsePaymentReference } from '#core/reference.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isClipId = (value) => typeof value === 'string' && UUID.test(value);

/** Estados oficiales -> 'paid' | 'failed' | 'pending'. Un estado desconocido NUNCA cuenta como pagado. */
const STATUS = {
	CHECKOUT_COMPLETED: 'paid',
	CHECKOUT_CANCELLED: 'failed',
	CHECKOUT_EXPIRED: 'failed',
	CHECKOUT_CREATED: 'pending',
	CHECKOUT_PENDING: 'pending'
};
export const normalizeClipStatus = (raw) => STATUS[String(raw ?? '').toUpperCase()] ?? 'pending';

export class ClipError extends Error {
	constructor(message, { status, code } = {}) {
		super(message);
		this.name = 'ClipError';
		this.status = status;
		this.code = code;
	}
}

/** Mensaje de un error de Clip: la doc muestra `message` y `code_message` segun el endpoint. */
const HINTS = {
	401: 'credenciales de Clip incorrectas',
	403: 'Clip bloquea solicitudes fuera de Mexico y EE. UU.',
	412: 'limite de peticiones de Clip'
};
function describeError(status, body) {
	const detail = body?.message ?? body?.code_message ?? body?.error ?? '';
	const hint = HINTS[status] ? ` (${HINTS[status]})` : '';
	return `Clip respondio ${status}${hint}${detail ? `: ${String(detail).slice(0, 200)}` : ''}`;
}

/**
 * @param {object} config
 * @param {string} config.baseUrl
 * @param {string} [config.token]   valor TAL CUAL del header Authorization (si existe, tiene prioridad)
 * @param {string} [config.key]     con `secret`: Authorization Basic base64(key:secret)
 * @param {string} [config.secret]
 * @param {string} config.webhookToken  token secreto de la URL del webhook; tambien firma las referencias
 */
export function createClipClient({
	baseUrl,
	token = '',
	key = '',
	secret = '',
	webhookToken,
	fetch: fetchFn = globalThis.fetch,
	timeoutMs = 8000
}) {
	const base = String(baseUrl ?? '').replace(/\/+$/, '');
	const authorization = token
		? token
		: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
	// el link redirige al comprador: https siempre, salvo contra un servidor de pruebas http
	const allowedLink = base.startsWith('http://') ? /^https?:\/\//i : /^https:\/\//i;

	async function call(path, init = {}) {
		let res;
		try {
			res = await fetchFn(`${base}${path}`, {
				...init,
				headers: {
					authorization,
					'content-type': 'application/json',
					accept: 'application/json',
					...(init.headers ?? {})
				},
				signal: AbortSignal.timeout(timeoutMs)
			});
		} catch (err) {
			throw new ClipError(`No pude conectar con Clip: ${err.message}`);
		}
		let body = null;
		try {
			body = await res.json();
		} catch {
			// sin cuerpo JSON
		}
		if (!res.ok)
			throw new ClipError(describeError(res.status, body), {
				status: res.status,
				code: body?.code ?? null
			});
		return body ?? {};
	}

	return {
		/** Hay credenciales y token de webhook: sin ellos el pago con tarjeta no se ofrece. */
		isConfigured: !!(base && (token || (key && secret)) && webhookToken),
		webhookToken,

		/** Referencia firmada de un pago nuestro, y su inversa (id del pago o null). */
		makeReference: (paymentId) => makePaymentReference(webhookToken, paymentId),
		parseReference: (reference) => parsePaymentReference(webhookToken, reference),

		/**
		 * Crea el link de pago. `amountCents` en centavos; Clip recibe pesos con 2 decimales.
		 * `reference` va en metadata.external_reference (<= 36 caracteres).
		 */
		async createCheckout({
			amountCents,
			description,
			reference,
			successUrl,
			errorUrl,
			defaultUrl,
			webhookUrl
		}) {
			const body = await call('/v2/checkout', {
				method: 'POST',
				body: JSON.stringify({
					amount: Number((amountCents / 100).toFixed(2)),
					currency: 'MXN',
					purchase_description: String(description).slice(0, 250),
					redirection_url: {
						success: successUrl,
						error: errorUrl,
						default: defaultUrl ?? successUrl
					},
					metadata: { external_reference: reference },
					webhook_url: webhookUrl,
					// solo tarjeta: el pago en efectivo de Clip es diferido y no encaja con la reserva de stock
					custom_payment_options: { payment_method_types: ['credit', 'debit'] }
				})
			});
			const id = body.payment_request_id;
			const url = body.payment_request_url;
			if (!isClipId(id)) throw new ClipError('Clip no devolvio un id de solicitud valido');
			if (!allowedLink.test(String(url ?? '')))
				throw new ClipError('Clip devolvio un link de pago no valido');
			return { id: String(id), url: String(url), expiresAt: body.expires_at ?? null };
		},

		/**
		 * Estado de una solicitud de pago:
		 * { id, status: 'paid'|'failed'|'pending', rawStatus, amountCents, currency, reference, receiptNo }.
		 * `receiptNo` solo viene cuando Clip ya lo completo.
		 */
		async getCheckout(id) {
			if (!isClipId(id)) throw new ClipError('Id de solicitud de pago no valido');
			const body = await call(`/v2/checkout/${encodeURIComponent(id)}`);
			const amount = Number(body.amount);
			return {
				id,
				status: normalizeClipStatus(body.status),
				rawStatus: body.status ?? null,
				amountCents: Number.isFinite(amount) ? Math.round(amount * 100) : null,
				currency: body.currency ?? null,
				reference: body.metadata?.external_reference ?? null,
				receiptNo: body.receipt_no ? String(body.receipt_no) : null
			};
		}
	};
}
