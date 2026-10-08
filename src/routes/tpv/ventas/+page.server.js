import { requirePermission } from '#core/guards.js';
import { rangeFor } from '#core/dates.js';
import { summarize } from '#modules/sales/queries.js';

/** Ventas del turno (hoy) del cajero. Se lee con SU token: las reglas de la base le dejan ver solo las suyas. */
/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url }) {
	const user = requirePermission(locals, url, 'pos:use');
	const { from } = rangeFor('hoy');
	const rows = await locals.pb.collection('orders').getFullList({
		filter: locals.pb.filter('created_by = {:me} && created >= {:from}', { me: user.id, from }),
		sort: '-created',
		fields: 'id,code,status,payment_method,total,discount,tax_total,channel,created'
	});
	const paid = rows.filter((o) => o.status === 'paid' || o.status === 'completed');
	return {
		orders: rows.map((o) => ({
			code: o.code,
			status: o.status,
			method: o.payment_method,
			total: o.total,
			createdAt: o.created
		})),
		summary: summarize(paid),
		pending: rows.filter((o) => o.status === 'pending').length
	};
}
