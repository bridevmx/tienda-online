import { createClipClient } from '#modules/payments/clip.js';

/** Cliente de Clip para los scripts (lee el entorno del proceso, igual que la app). */
export function scriptClip(env = process.env) {
	return createClipClient({
		baseUrl: env.CLIP_API_URL || 'https://api.payclip.com',
		token: env.CLIP_API_TOKEN || '',
		key: env.CLIP_API_KEY || '',
		secret: env.CLIP_API_SECRET || '',
		webhookToken: env.CLIP_WEBHOOK_TOKEN || ''
	});
}
