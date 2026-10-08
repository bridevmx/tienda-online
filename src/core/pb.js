import PocketBase from 'pocketbase';

/**
 * Crea un cliente de PocketBase para el servidor. PocketBase vive en red interna y solo
 * SvelteKit le habla; el navegador nunca. Un cliente nuevo por solicitud: no compartir
 * instancias entre usuarios porque llevan su propia sesion (authStore).
 */
export function createPb(url) {
	if (!url) throw new Error('Falta PB_URL');
	const pb = new PocketBase(url);
	// sin cancelacion automatica: SvelteKit puede disparar solicitudes paralelas con el mismo cliente
	pb.autoCancellation(false);
	return pb;
}
