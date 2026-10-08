import { createCrudService } from './crud.js';
import { describeResource } from './resource.js';
import { formatCell } from './crud-format.js';
import { routes } from './routes.js';

/**
 * Opciones de los campos que apuntan a otra coleccion (select de categoria, lista de permisos,
 * valores de opcion): { campo: [{ value, label, hint?, group?: { key, label } }] }.
 * En un registro que se edita se excluye a si mismo (una categoria no puede ser su propio padre).
 * `only` limita a ciertos campos; `ctx` se pasa a `group()` (etiquetas de modulo en los permisos).
 */
export async function loadFieldOptions(pb, resource, { excludeId, only, ctx } = {}) {
	const out = {};
	for (const field of resource.fields) {
		const opt = field.options;
		if (!opt || (only && !only.includes(field.name))) continue;
		const records = await pb.collection(opt.collection).getFullList({
			sort: opt.sort,
			filter: opt.filter,
			expand: opt.expand
		});
		out[field.name] = records
			.filter((r) => !(opt.collection === resource.collection && r.id === excludeId))
			.map((r) => ({
				value: r.id,
				label: opt.label(r),
				hint: opt.hint?.(r),
				group: opt.group?.(r, ctx)
			}));
	}
	return out;
}

/** Fila de tabla lista para pintar. */
export function toRow(resource, record, { permissions }) {
	const allowedEdit =
		permissions.has(resource.permissions.update) && (resource.canEdit?.(record) ?? true);
	const allowedDelete =
		permissions.has(resource.permissions.delete) && (resource.canDelete?.(record) ?? true);
	return {
		id: record.id,
		title: String(record[resource.titleField] ?? record.id),
		cells: resource.columns.map((c) => formatCell(c, record, resource.collection)),
		href: routes.admin.edit(resource.name, record.id),
		canEdit: allowedEdit,
		canDelete: allowedDelete
	};
}

/** Tablas de registros hijos para la pagina de edicion del padre (variantes de un producto). */
export async function loadChildren(pb, resource, parentId, { resources, permissions, returnTo }) {
	const out = [];
	for (const child of resource.children) {
		const target = resources.get(child.resource);
		if (!permissions.has(target.permissions.read)) continue;
		const crud = createCrudService(pb, target);
		const result = await crud.list({
			page: 1,
			perPage: 100,
			q: '',
			sort: target.defaultSort,
			filters: { [child.foreignKey]: parentId }
		});
		const query = new URLSearchParams({ [child.foreignKey]: parentId, next: returnTo });
		out.push({
			label: child.label,
			foreignKey: child.foreignKey,
			resource: describeResource(target),
			rows: result.items.map((r) => ({
				...toRow(target, r, { permissions }),
				href: `${routes.admin.edit(target.name, r.id)}?next=${encodeURIComponent(returnTo)}`
			})),
			canCreate: permissions.has(target.permissions.create),
			newHref: `${routes.admin.create(target.name)}?${query}`
		});
	}
	return out;
}
