import { requirePermission } from '#core/guards.js';
import { loadFieldOptions } from '#core/crud-load.js';
import {
	moduleLabels,
	nextOf,
	prefillFromQuery,
	resourceOr404,
	saveFromRequest,
	toFormValues
} from '#core/crud-routes.js';
import { describeResource } from '#core/resource.js';
import { routes } from '#core/routes.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, url, locals }) {
	const resource = resourceOr404(params.resource);
	requirePermission(locals, url, resource.permissions.create);

	const { values } = toFormValues(resource, prefillFromQuery(resource, url.searchParams));
	return {
		resource: describeResource(resource),
		values,
		options: await loadFieldOptions(locals.pb, resource, { ctx: { moduleLabels } }),
		backHref: nextOf(url, routes.admin.list(resource.name))
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ params, request, url, locals, cookies }) => {
		const resource = resourceOr404(params.resource);
		requirePermission(locals, url, resource.permissions.create);
		return saveFromRequest({ resource, locals, request, url, cookies });
	}
};
