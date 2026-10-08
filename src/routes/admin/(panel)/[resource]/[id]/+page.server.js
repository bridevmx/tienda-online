import { error } from '@sveltejs/kit';
import { requirePermission } from '#core/guards.js';
import { createCrudService } from '#core/crud.js';
import { loadChildren, loadFieldOptions } from '#core/crud-load.js';
import {
	deleteFromRequest,
	describeFiles,
	moduleLabels,
	nextOf,
	resourceOr404,
	saveFromRequest,
	toFormValues
} from '#core/crud-routes.js';
import { describeResource } from '#core/resource.js';
import { resources } from '#core/resources.js';
import { routes } from '#core/routes.js';

async function loadRecord(resource, locals, id) {
	const record = await createCrudService(locals.pb, resource).get(id);
	if (!record) error(404, 'No encontrado');
	return record;
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, url, locals }) {
	const resource = resourceOr404(params.resource);
	requirePermission(locals, url, resource.permissions.read);
	const record = await loadRecord(resource, locals, params.id);

	const { values, files } = toFormValues(resource, record);
	const here = url.pathname;
	// ?/save y ?/delete reemplazan el query string: se conserva ?next= (a donde volver)
	const next = nextOf(url, '');
	const keepNext = next ? `&next=${encodeURIComponent(next)}` : '';
	return {
		saveAction: `?/save${keepNext}`,
		deleteAction: `?/delete${keepNext}`,
		resource: describeResource(resource),
		record: { id: record.id, title: String(record[resource.titleField] ?? record.id) },
		values,
		files: describeFiles(resource, record, files),
		options: await loadFieldOptions(locals.pb, resource, {
			excludeId: record.id,
			ctx: { moduleLabels }
		}),
		children: await loadChildren(locals.pb, resource, record.id, {
			resources,
			permissions: locals.permissions,
			returnTo: here
		}),
		canUpdate:
			locals.permissions.has(resource.permissions.update) && (resource.canEdit?.(record) ?? true),
		canDelete:
			locals.permissions.has(resource.permissions.delete) && (resource.canDelete?.(record) ?? true),
		backHref: nextOf(url, routes.admin.list(resource.name))
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	// SvelteKit no permite una accion `default` junto a acciones con nombre
	save: async ({ params, request, url, locals, cookies }) => {
		const resource = resourceOr404(params.resource);
		requirePermission(locals, url, resource.permissions.update);
		const existing = await loadRecord(resource, locals, params.id);
		if (resource.canEdit && !resource.canEdit(existing))
			error(403, 'Este registro no se puede editar');
		return saveFromRequest({ resource, locals, request, url, cookies, id: params.id, existing });
	},

	delete: async ({ params, request, url, locals, cookies }) => {
		const resource = resourceOr404(params.resource);
		requirePermission(locals, url, resource.permissions.delete);
		await deleteFromRequest({
			resource,
			locals,
			request,
			cookies,
			backTo: nextOf(url, routes.admin.list(resource.name))
		});
	}
};
