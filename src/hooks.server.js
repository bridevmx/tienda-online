import { env } from '$env/dynamic/private';
import { createPb } from '#core/pb.js';
import { THEME_COOKIE, resolveTheme } from '#core/themes.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// Un cliente de PocketBase por solicitud. La autenticacion (fase 1) se agrega aqui.
	event.locals.pb = createPb(env.PB_URL ?? 'http://127.0.0.1:8090');
	event.locals.theme = resolveTheme(event.cookies.get(THEME_COOKIE));

	return resolve(event, {
		// el tema se pone en <html> desde el servidor para que no haya parpadeo
		transformPageChunk: ({ html }) => html.replace('%theme%', event.locals.theme)
	});
}
