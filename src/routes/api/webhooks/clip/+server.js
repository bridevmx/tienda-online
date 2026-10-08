import { json } from '@sveltejs/kit';
import { clientKey, webhookHits } from '#core/limits.js';
import { processClipNotification, tokenMatches } from '#modules/payments/clip-webhook.js';

/**
 * Webhook de Clip: `{ id, origin, event_type }`, sin firma. Es un AVISO, no una prueba: solo se usa el
 * `id` para preguntarle a Clip el estado real (ver clip-webhook.js). La URL lleva ademas un token
 * secreto (?token=) como filtro extra.
 *
 * Responde 200 enseguida y verifica despues (Clip no documenta que espera ni cuanto aguanta); si la
 * verificacion falla, el reconciliador (`jobs:reconcile-payments`) lo recupera.
 */
/** @type {import('./$types').RequestHandler} */
export async function POST({ request, url, locals, getClientAddress }) {
	if (!locals.clip.isConfigured) return json({ error: 'not found' }, { status: 404 });
	if (webhookHits.hit(`clip:${clientKey(getClientAddress)}`))
		return json({ error: 'too many requests' }, { status: 429 });
	if (!tokenMatches(url.searchParams.get('token'), locals.clip.webhookToken)) {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const pb = await locals.adminPb();
	const sales = await locals.sales();
	processClipNotification({ payload, pb, clip: locals.clip, sales }).catch((err) =>
		console.error(
			'[clip webhook] no se pudo verificar (lo recupera el reconciliador):',
			err?.message ?? err
		)
	);
	return json({ ok: true });
}
