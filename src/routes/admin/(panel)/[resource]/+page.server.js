import { requirePermission } from '#core/guards.js';
import { createCrudService } from '#core/crud.js';
import { loadFieldOptions, toRow } from '#core/crud-load.js';
import { deleteFromRequest, resourceOr404 } from '#core/crud-routes.js';
import { parseListQuery } from '#core/crud-query.js';
import { describeResource } from '#core/resource.js';

/** Listado generico: busqueda, filtros, orden y paginacion. */
/** @type {import('./$types').PageServerLoad} */
export async function load({ params, url, locals }) {
	const resource = resourceOr404(params.resource);
	requirePermission(locals, url, resource.permissions.read);

	const query = parseListQuery(resource, url.searchParams);
	const result = await createCrudService(locals.pb, resource).list(query);

	// opciones de los filtros que apuntan a otra coleccion (p. ej. categoria)
	const relationFilters = resource.filters.filter((f) => f.type === 'relation').map((f) => f.name);
	const filterOptions = await loadFieldOptions(locals.pb, resource, { only: relationFilters });

	return {
		resource: describeResource(resource),
		rows: result.items.map((r) => toRow(resource, r, { permissions: locals.permissions })),
		pagination: { page: result.page, totalPages: result.totalPages, totalItems: result.totalItems },
		query: { q: query.q, sort: query.sort, filters: query.filters },
		filterOptions,
		canCreate: locals.permissions.has(resource.permissions.create)
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	delete: async ({ params, locals, request, cookies, url }) => {
		const resource = resourceOr404(params.resource);
		requirePermission(locals, url, resource.permissions.delete);
		await deleteFromRequest({
			resource,
			locals,
			request,
			cookies,
			backTo: url.pathname + url.search
		});
	}
};
