import { DomainError } from './errors.js';
import { buildListFilter } from './crud-query.js';
import { saveRecord } from './crud-payload.js';
import { guard } from './pb-errors.js';

/** Valida con el schema del recurso; ante un problema lanza DomainError con el primer error y su campo. */
function parse(schema, input) {
	const result = schema.safeParse(input);
	if (result.success) return result.data;
	const issue = result.error.issues[0];
	throw new DomainError(issue.message, { field: issue.path.join('.') || '_' });
}

const notFoundToNull = (err) => {
	if (err?.status === 404) return null;
	throw err;
};

/**
 * Servicio CRUD de un recurso. Recibe el cliente de PocketBase de quien llama (sus reglas aplican).
 * Si el recurso trae `service(pb)`, sus `create`/`update` reemplazan a los por defecto: asi un modulo
 * agrega reglas propias (p. ej. integridad de variantes) sin tocar el CRUD generico.
 *
 * `extras` = { uploads, removals } con los archivos del formulario (ver saveRecord).
 */
export function createCrudService(pb, resource) {
	const collection = resource.collection;
	const override = resource.service?.(pb) ?? {};

	return {
		async list(query) {
			const result = await pb.collection(collection).getList(query.page, query.perPage, {
				filter: buildListFilter(pb, resource, query),
				sort: query.sort,
				expand: resource.expand
			});
			return {
				items: result.items,
				page: result.page,
				perPage: result.perPage,
				totalItems: result.totalItems,
				totalPages: result.totalPages
			};
		},

		async get(id) {
			return pb
				.collection(collection)
				.getOne(id, { expand: resource.expand })
				.catch(notFoundToNull);
		},

		async create(input, extras = {}) {
			if (override.create) return override.create(input, extras);
			const data = parse(resource.schema, input);
			return guard(() => saveRecord(pb, collection, null, data, extras));
		},

		async update(id, input, extras = {}) {
			if (override.update) return override.update(id, input, extras);
			const data = parse(resource.schema, input);
			return guard(() => saveRecord(pb, collection, id, data, extras));
		},

		async remove(id) {
			try {
				await pb.collection(collection).delete(id);
			} catch (err) {
				// la base protege borrados con relaciones (400) o reglas (404/403)
				if ([400, 403, 404].includes(err?.status)) {
					throw new DomainError('No se puede eliminar: está en uso o no tienes permiso');
				}
				throw err;
			}
		}
	};
}
