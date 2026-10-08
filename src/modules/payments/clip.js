/**
 * Cliente de la API de Clip (links de pago de "Checkout Redireccionado" y su consulta de estado).
 *
 * Lo que se uso de la documentacion publica de Clip (developer.clip.mx):
 *   POST {base}/v2/checkout        crea el link. Basic auth (key:secret). Responde payment_request_id,
 *                                   payment_request_url, status, expires_at, qr_image_url.
 *   GET  {base}/v2/checkout/{id}    estado de la solicitud de pago.
 *   webhook_url                     Clip avisa (POST) cuando cambia el estado; reintenta si falla.
 * Los detalles que la documentacion no fija (valores exactos de `status`, firma del webhook) NO se
 * asumen: el webhook solo dice "algo cambio en esta solicitud" y el estado real SIEMPRE se consulta
 * a Clip con nuestras credenciales (ver clip-webhook.js). `normalizeClipStatus` tolera variantes.
 * Revisar contra una cuenta real antes de salir a produccion (docs/PLAN.md, pendientes).
 */

/** Estado de Clip -> 'paid' | 'failed' | 'pending'. Tolera "COMPLETED", "CHECKOUT_COMPLETED", etc. */
export function normalizeClipStatus(raw) {
	const status = String(raw ?? '').toUpperCase();
	if (/COMPLETED|PAID|APPROVED|SUCCE/.test(status)) return 'paid';
	if (/CANCEL|EXPIRED|FAILED|DECLINED|REJECT/.test(status)) return 'failed';
	return 'pending';
}

export class ClipError extends Error {
	constructor(message, { status } = {}) {
		super(message);
		this.name = 'ClipError';
		this.status = status;
	}
}

/**
 * @param {{ baseUrl: string, key: string, secret: string, webhookToken: string, fetch?: typeof fetch, timeoutMs?: number }} config
 */
export function createClipClient({
	baseUrl,
	key,
	secret,
	webhookToken,
	fetch: fetchFn = globalThis.fetch,
	timeoutMs = 8000
}) {
	const base = String(baseUrl ?? '').replace(/\/+$/, '');
	const authorization = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;

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
		if (!res.ok) throw new ClipError(`Clip respondio ${res.status}`, { status: res.status });
		return body ?? {};
	}

	return {
		/** Hay credenciales y token de webhook: sin ellos el pago con tarjeta no se ofrece. */
		isConfigured: !!(base && key && secret && webhookToken),
		webhookToken,

		/** Crea el link de pago. `amountCents` en centavos; Clip recibe pesos. */
		async createCheckout({ amountCents, description, successUrl, errorUrl, webhookUrl }) {
			const body = await call('/v2/checkout', {
				method: 'POST',
				body: JSON.stringify({
					amount: Number((amountCents / 100).toFixed(2)),
					currency: 'MXN',
					purchase_description: description,
					redirection_url: { success: successUrl, error: errorUrl, default: successUrl },
					webhook_url: webhookUrl
				})
			});
			const id = body.payment_request_id ?? body.id;
			const url = body.payment_request_url ?? body.url;
			if (!id || !url) throw new ClipError('Clip no devolvio el link de pago');
			// el link se usara para redirigir al comprador: solo http(s)
			if (!/^https?:\/\//i.test(String(url)))
				throw new ClipError('Clip devolvio un link de pago no valido');
			return { id: String(id), url: String(url), expiresAt: body.expires_at ?? null };
		},

		/** Estado actual de una solicitud de pago: { id, status: 'paid' | 'failed' | 'pending', raw }. */
		async getCheckout(id) {
			const body = await call(`/v2/checkout/${encodeURIComponent(id)}`);
			return {
				id,
				status: normalizeClipStatus(body.status ?? body.resource_status),
				raw: body.status ?? body.resource_status ?? null
			};
		}
	};
}
