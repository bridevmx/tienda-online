import { RANGES, rangeFor } from '#core/dates.js';
import { requirePermission } from '#core/guards.js';
import { routes } from '#core/routes.js';
import { listOrders, salesSummary } from '#modules/sales/queries.js';
import {
	CHANNEL_LABEL,
	METHOD_LABEL,
	ORDER_STATUS,
	orderStatusView
} from '#modules/sales/status.js';

const pick = (value, allowed) => (allowed.includes(value) ? value : '');
const toPage = (value) => Math.min(Math.max(parseInt(value ?? '1', 10) || 1, 1), 10000);

/** Ventas web y TPV: resumen del periodo, filtros por estado/canal/metodo y listado. */
/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url }) {
	requirePermission(locals, url, 'orders:read');
	const sp = url.searchParams;

	const status = pick(sp.get('estado'), Object.keys(ORDER_STATUS));
	const channel = pick(sp.get('canal'), Object.keys(CHANNEL_LABEL));
	const method = pick(sp.get('metodo'), Object.keys(METHOD_LABEL));
	const rangeKey = pick(sp.get('rango'), Object.keys(RANGES)) || '30d';
	const q = (sp.get('q') ?? '').trim().slice(0, 100);
	const custom = { from: sp.get('desde') ?? '', to: sp.get('hasta') ?? '' };
	const range = rangeFor(rangeKey, new Date(), custom);

	const [summary, list] = await Promise.all([
		salesSummary(locals.pb, range),
		listOrders(locals.pb, {
			page: toPage(sp.get('page')),
			q,
			filters: { status, channel, payment_method: method, from: range.from, to: range.to }
		})
	]);

	return {
		filters: { status, channel, method, q, range: rangeKey, from: custom.from, to: custom.to },
		ranges: RANGES,
		statuses: Object.entries(ORDER_STATUS).map(([id, v]) => ({ id, label: v.label })),
		channels: CHANNEL_LABEL,
		methods: METHOD_LABEL,
		summary,
		pagination: { page: list.page, totalPages: list.totalPages, totalItems: list.totalItems },
		rows: list.items.map((o) => ({
			id: o.id,
			href: routes.admin.sale(o.id),
			code: o.code,
			createdAt: o.created,
			channel: CHANNEL_LABEL[o.channel] ?? o.channel,
			who: o.contact_name || o.contact_email || 'Mostrador',
			method: METHOD_LABEL[o.payment_method] ?? o.payment_method,
			status: orderStatusView(o.status),
			total: o.total
		}))
	};
}
