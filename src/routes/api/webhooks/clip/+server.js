import { json } from '@sveltejs/kit';
import { processClipNotification, tokenMatches } from '#modules/payments/clip-webhook.js';

/**
 * Webhook de Clip. La URL lleva un token secreto (?token=) porque Clip no documenta una firma; aun
 * asi el aviso no se toma por cierto: el estado se consulta a Clip (ver clip-webhook.js).
 * Responde 200 a lo que no es nuestro/no aplica (para que Clip no reintente) y 502 si no pudimos
 * verificar (para que reintente).
 */
/** @type {import('./$types').RequestHandler} */
export async function POST({ request, url, locals }) {
	if (!locals.clip.isConfigured) return json({ error: 'not found' }, { status: 404 });
	if (!tokenMatches(url.searchParams.get('token'), locals.clip.webhookToken)) {
		return json({ error: 'forbidden' }, { status: 403 });
	}

	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	try {
		const result = await processClipNotification({
			payload,
			pb: await locals.adminPb(),
			clip: locals.clip,
			sales: await locals.sales()
		});
		return json({ ok: true, ...result });
	} catch (err) {
		console.error('[clip webhook] no se pudo procesar:', err?.message ?? err);
		return json({ error: 'could not verify payment' }, { status: 502 });
	}
}
