/** Parametros de la URL del listado (?q, ?page, ?sort, filtros), validados contra lo que el recurso permite. */
export const PER_PAGE = 20;

const ID = /^[a-z0-9]{15}$/;

export function parseListQuery(resource, searchParams) {
	const page = Math.min(Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1), 10000);
	const q = (searchParams.get('q') ?? '').trim().slice(0, 100);

	const sortable = new Set([
		'created',
		'updated',
		...resource.columns.filter((c) => c.sortable).map((c) => c.key)
	]);
	const requested = searchParams.get('sort') ?? '';
	const key = requested.replace(/^-/, '');
	const sort = sortable.has(key) ? requested : resource.defaultSort;

	const filters = {};
	for (const filter of resource.filters) {
		const value = searchParams.get(filter.name);
		if (value == null || value === '') continue;
		if (filter.type === 'relation' && ID.test(value)) filters[filter.name] = value;
		if (filter.type === 'bool' && (value === '1' || value === '0'))
			filters[filter.name] = value === '1';
	}
	return { page, q, sort, filters, perPage: PER_PAGE };
}

/** Arma el filtro de PocketBase (con parametros enlazados, nunca texto del usuario concatenado). */
export function buildListFilter(pb, resource, { q, filters }) {
	const parts = [];
	const params = {};
	if (q && resource.search.length) {
		parts.push(`(${resource.search.map((field) => `${field} ~ {:q}`).join(' || ')})`);
		params.q = q;
	}
	for (const [name, value] of Object.entries(filters)) {
		parts.push(`${name} = {:f_${name}}`);
		params[`f_${name}`] = value;
	}
	return parts.length ? pb.filter(parts.join(' && '), params) : '';
}
