import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Sirve los archivos de PocketBase desde la propia app: el navegador nunca habla con PocketBase.
 * Solo colecciones del catalogo, solo imagenes y solo las miniaturas configuradas en las migraciones.
 */
const COLLECTIONS = new Set(['categories', 'products', 'variants']);
const THUMBS = new Set(['160x160', '480x480', '960x0']);
const ID = /^[a-z0-9]{15}$/;
const FILE = /^[\w][\w.-]*$/;

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url, fetch }) {
	const { collection, id, file } = params;
	if (!COLLECTIONS.has(collection) || !ID.test(id) || !FILE.test(file)) error(404, 'No encontrado');

	const thumb = url.searchParams.get('thumb');
	if (thumb && !THUMBS.has(thumb)) error(404, 'No encontrado');

	const base = env.PB_URL || 'http://127.0.0.1:8090';
	const upstream = await fetch(
		`${base}/api/files/${collection}/${id}/${encodeURIComponent(file)}${thumb ? `?thumb=${thumb}` : ''}`
	);
	const type = upstream.headers.get('content-type') ?? '';
	if (!upstream.ok || !type.startsWith('image/')) error(404, 'No encontrado');

	return new Response(upstream.body, {
		headers: {
			'content-type': type,
			// los nombres de archivo llevan un sufijo aleatorio: un archivo nuevo es una URL nueva
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
}
