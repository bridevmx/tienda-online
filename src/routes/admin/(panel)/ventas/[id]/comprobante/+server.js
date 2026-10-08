import { error } from '@sveltejs/kit';
import { PB_URL } from '$app/env/private';
import { recordId } from '#core/fields.js';
import { requirePermission } from '#core/guards.js';

/**
 * Sirve el comprobante de transferencia (archivo PRIVADO de PocketBase) solo al personal con
 * orders:read. La app pide el token de archivo con el superusuario y trae el archivo desde el servidor:
 * el navegador nunca recibe una URL de PocketBase.
 */
/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, url, params, fetch }) {
	requirePermission(locals, url, 'orders:read');
	if (!recordId().safeParse(params.id).success) error(404, 'No encontrado');

	// el personal solo llega aqui si puede ver el pedido (regla de la base con SU token)
	const payments = await locals.pb.collection('payments').getFullList({
		filter: locals.pb.filter('order = {:id} && proof != ""', { id: params.id }),
		sort: '-created'
	});
	const payment = payments[0];
	if (!payment) error(404, 'No hay comprobante');

	const admin = await locals.adminPb();
	const token = await admin.files.getToken();
	const upstream = await fetch(
		`${PB_URL}/api/files/payments/${payment.id}/${encodeURIComponent(payment.proof)}?token=${encodeURIComponent(token)}`
	);
	if (!upstream.ok) error(404, 'No hay comprobante');

	return new Response(upstream.body, {
		headers: {
			'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
			'content-disposition': 'inline',
			'x-content-type-options': 'nosniff',
			'cache-control': 'private, no-store'
		}
	});
}
