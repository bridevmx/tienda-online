const notFoundToNull = (err) => {
	if (err?.status === 404) return null;
	throw err;
};

/**
 * Pedido completo: { order, items, payments, payment (el vigente), financials }.
 * `pb` puede ser el del personal (las reglas aplican: sin orders:read no ve `financials`) o el de
 * superusuario. `by` = { id } | { code }.
 */
export async function loadBundle(pb, by) {
	const order = await (
		by.id
			? pb.collection('orders').getOne(by.id)
			: pb.collection('orders').getFirstListItem(pb.filter('code = {:code}', { code: by.code }))
	).catch(notFoundToNull);
	if (!order) return null;

	const byOrder = pb.filter('order = {:id}', { id: order.id });
	const [items, payments, financials] = await Promise.all([
		pb.collection('order_items').getFullList({ filter: byOrder, sort: 'created' }),
		pb.collection('payments').getFullList({ filter: byOrder, sort: '-created' }),
		pb
			.collection('order_financials')
			.getFirstListItem(byOrder)
			.catch((err) => (err?.status === 404 || err?.status === 403 ? null : Promise.reject(err)))
	]);
	// el pago vigente: el pendiente o confirmado mas reciente (los fallidos son intentos anteriores)
	const payment = payments.find((p) => p.status !== 'failed') ?? payments[0] ?? null;
	return { order, items, payments, payment, financials };
}

/** Listado para el admin con filtros validados por el llamador. */
export async function listOrders(pb, { page = 1, perPage = 20, filters = {}, q = '' } = {}) {
	const parts = [];
	const params = {};
	for (const [key, value] of Object.entries(filters)) {
		if (value === '' || value == null) continue;
		if (key === 'from') {
			parts.push('created >= {:from}');
			params.from = value;
		} else if (key === 'to') {
			parts.push('created <= {:to}');
			params.to = value;
		} else {
			parts.push(`${key} = {:f_${key}}`);
			params[`f_${key}`] = value;
		}
	}
	if (q) {
		parts.push('(code ~ {:q} || contact_name ~ {:q} || contact_email ~ {:q})');
		params.q = q;
	}
	return pb.collection('orders').getList(page, perPage, {
		filter: parts.length ? pb.filter(parts.join(' && '), params) : '',
		sort: '-created'
	});
}

/**
 * Resumen de ventas (pagadas y completadas) entre dos fechas: totales por canal y por metodo.
 * PocketBase no agrupa: se lee solo lo necesario y se suma aqui.
 */
export async function salesSummary(pb, { from, to } = {}) {
	const parts = ['(status = "paid" || status = "completed")'];
	const params = {};
	if (from) {
		parts.push('created >= {:from}');
		params.from = from;
	}
	if (to) {
		parts.push('created <= {:to}');
		params.to = to;
	}
	const rows = await pb.collection('orders').getFullList({
		filter: pb.filter(parts.join(' && '), params),
		fields: 'id,channel,payment_method,total,discount,tax_total,created',
		sort: '-created'
	});
	return summarize(rows);
}

/** Suma pura (testeable) de filas de pedidos. */
export function summarize(rows) {
	const empty = () => ({ count: 0, total: 0, discount: 0, tax: 0 });
	const out = { all: empty(), byChannel: {}, byMethod: {}, byDay: {} };
	const add = (bucket, row) => {
		bucket.count += 1;
		bucket.total += row.total ?? 0;
		bucket.discount += row.discount ?? 0;
		bucket.tax += row.tax_total ?? 0;
	};
	for (const row of rows) {
		add(out.all, row);
		add((out.byChannel[row.channel] ??= empty()), row);
		add((out.byMethod[row.payment_method] ??= empty()), row);
		add((out.byDay[String(row.created).slice(0, 10)] ??= empty()), row);
	}
	return out;
}
