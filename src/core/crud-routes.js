import { error, fail, redirect } from '@sveltejs/kit';
import { DomainError } from './errors.js';
import { extractFiles, formDataToObject, parseForm } from './validate.js';
import { createCrudService } from './crud.js';
import { fileFields, toFormValues, toInput, toRepaintValues } from './crud-form.js';
import { setFlash } from './flash.js';
import { recordId } from './fields.js';
import { safeNext } from './redirect.js';
import { routes } from './routes.js';
import { modules, resources } from './resources.js';

/** Recurso por nombre de URL; 404 si no existe. */
export function resourceOr404(name) {
	const resource = resources.get(name);
	if (!resource) error(404, 'No encontrado');
	return resource;
}

/** Nombres de modulo -> etiqueta (para agrupar permisos en el formulario de roles). */
export const moduleLabels = new Map(modules.map((m) => [m.name, m.label]));

/** Destino tras guardar: ?next= si es una ruta del admin; si no, `fallback`. */
export const nextOf = (url, fallback) =>
	safeNext(url.searchParams.get('next'), { prefix: '/admin', fallback });

/** Valores iniciales de "nuevo" a partir de ?campo=id (solo campos marcados `prefill`). */
export function prefillFromQuery(resource, searchParams) {
	const record = {};
	for (const field of resource.fields) {
		const value = searchParams.get(field.name);
		if (field.prefill && value && recordId().safeParse(value).success) record[field.name] = value;
	}
	return record;
}

/** Archivos existentes de un registro con su URL de miniatura. */
export function describeFiles(resource, record, files) {
	const out = {};
	for (const [name, list] of Object.entries(files)) {
		out[name] = list.map((filename) => ({
			name: filename,
			src: routes.media(resource.collection, record.id, filename, '160x160')
		}));
	}
	return out;
}

const SAFE_FILENAME = /^[\w][\w.-]*$/;

/** Archivos subidos y archivos a quitar del formulario. */
function readFiles(resource, formData) {
	const fields = fileFields(resource);
	const found = extractFiles(
		formData,
		fields.map((f) => f.name)
	);
	const uploads = {};
	const removals = {};
	for (const field of fields) {
		if (found[field.name])
			uploads[field.name] = { files: found[field.name], append: field.type === 'images' };
		const names = formData
			.getAll(`remove_${field.name}`)
			.filter((n) => typeof n === 'string' && SAFE_FILENAME.test(n));
		if (names.length) removals[field.name] = names;
	}
	return { uploads, removals };
}

/**
 * Procesa el formulario de crear/editar: valida, guarda y redirige. Devuelve `fail(400, ...)` con los
 * errores por campo (y lo escrito) si algo no cuadra. Sin `id` crea; con `id` edita.
 */
export async function saveFromRequest({
	resource,
	locals,
	request,
	url,
	cookies,
	id = null,
	existing = null
}) {
	const formData = await request.formData();
	const raw = formDataToObject(formData);
	// los campos inmutables no se cambian al editar: se conserva el valor del registro
	if (existing) {
		for (const field of resource.fields)
			if (field.immutable) raw[field.name] = existing[field.name];
	}
	const repaint = () => toRepaintValues(resource, raw);

	const parsed = parseForm(resource.schema, toInput(resource, raw));
	if (!parsed.ok) return fail(400, { errors: parsed.errors, values: repaint() });

	const crud = createCrudService(locals.pb, resource);
	const extras = readFiles(resource, formData);
	let record;
	try {
		record = id
			? await crud.update(id, parsed.data, extras)
			: await crud.create(parsed.data, extras);
	} catch (err) {
		if (err instanceof DomainError)
			return fail(400, { errors: { [err.field]: err.message }, values: repaint() });
		throw err;
	}

	setFlash(cookies, { text: id ? 'Cambios guardados' : 'Registro creado' });
	redirect(303, nextOf(url, routes.admin.edit(resource.name, record.id)));
}

/** Elimina el registro `id` del formulario; siempre vuelve a `backTo` con un aviso. */
export async function deleteFromRequest({ resource, locals, request, cookies, backTo }) {
	const id = String((await request.formData()).get('id') ?? '');
	if (!recordId().safeParse(id).success) error(400, 'Solicitud inválida');

	const crud = createCrudService(locals.pb, resource);
	const record = await crud.get(id);
	if (!record) error(404, 'No encontrado');
	if (resource.canDelete && !resource.canDelete(record))
		error(403, 'Este registro no se puede eliminar');

	try {
		await crud.remove(id);
		setFlash(cookies, { text: 'Registro eliminado' });
	} catch (err) {
		if (!(err instanceof DomainError)) throw err;
		setFlash(cookies, { type: 'error', text: err.message });
	}
	redirect(303, backTo);
}

export { toFormValues };
