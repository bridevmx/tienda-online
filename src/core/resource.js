import { z } from 'zod';

/**
 * Un RECURSO describe una coleccion administrable: de aqui salen la tabla, el formulario, las rutas
 * `/admin/<name>` y los permisos que se exigen. Un modulo declara sus recursos en su manifiesto y
 * el CRUD generico (src/routes/admin/(panel)/[resource]) hace el resto, sin codigo por recurso.
 *
 * Los esquemas Zod validan en el servidor; `fields` solo dice COMO se pinta cada campo.
 */
const fn = z.custom((v) => typeof v === 'function', 'debe ser una funcion');
const permissionCode = z.string().regex(/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/);

export const FIELD_TYPES = [
	'text',
	'textarea',
	'html',
	'integer',
	'money',
	'checkbox',
	'relation',
	'relations',
	'groups',
	'image',
	'images'
];
export const COLUMN_TYPES = [
	'text',
	'muted',
	'code',
	'bool',
	'money',
	'integer',
	'stock',
	'relation',
	'relations',
	'count',
	'date',
	'image'
];

/** Como se obtienen las opciones de un campo que apunta a otra coleccion. */
const optionsSchema = z.object({
	collection: z.string().min(1),
	sort: z.string().optional(),
	filter: z.string().optional(),
	expand: z.string().optional(),
	/** (registro) -> texto de la opcion */
	label: fn,
	/** (registro) -> { key, label } para agrupar opciones (permisos por modulo, valores por opcion) */
	group: fn.optional(),
	/** (registro) -> texto secundario */
	hint: fn.optional()
});

const fieldSchema = z.object({
	name: z.string().min(1),
	label: z.string().min(1),
	type: z.enum(FIELD_TYPES),
	required: z.boolean().default(false),
	help: z.string().optional(),
	placeholder: z.string().optional(),
	options: optionsSchema.optional(),
	/** Se puede rellenar desde la URL (?campo=id), p. ej. al crear una variante desde su producto. */
	prefill: z.boolean().default(false),
	/** No se puede cambiar una vez creado el registro. */
	immutable: z.boolean().default(false)
});

const columnSchema = z.object({
	key: z.string().min(1),
	label: z.string(), // vacio en columnas sin encabezado (miniaturas)
	type: z.enum(COLUMN_TYPES).default('text'),
	sortable: z.boolean().default(false),
	/** relation / relations: campo del registro expandido que se muestra */
	labelKey: z.string().optional(),
	/** bool: [texto si es verdadero, texto si es falso] ('' = no mostrar nada) */
	labels: z.tuple([z.string(), z.string()]).optional(),
	/** image: miniatura a pedir */
	thumb: z.string().optional()
});

const resourceSchema = z.object({
	name: z.string().regex(/^[a-z][a-z0-9_]*$/),
	collection: z.string().optional(),
	label: z.tuple([z.string(), z.string()]), // [singular, plural]
	/** Genero gramatical del singular, para "Nueva categoría" / "Nuevo producto". */
	feminine: z.boolean().default(false),
	permissions: z.object({
		read: permissionCode,
		create: permissionCode,
		update: permissionCode,
		delete: permissionCode
	}),
	schema: z.custom((v) => v && typeof v.safeParse === 'function', 'debe ser un schema de Zod'),
	titleField: z.string().default('name'),
	columns: z.array(columnSchema).min(1),
	fields: z.array(fieldSchema).min(1),
	search: z.array(z.string()).default([]),
	defaultSort: z.string().default('-created'),
	expand: z.string().optional(),
	/** Filtros permitidos en la URL (?categoria=id, ?active=1). */
	filters: z
		.array(z.object({ name: z.string(), type: z.enum(['relation', 'bool']), label: z.string() }))
		.default([]),
	/** Registros hijos que se listan en la pagina de edicion (variantes de un producto). */
	children: z
		.array(
			z.object({
				resource: z.string(),
				foreignKey: z.string(),
				label: z.string()
			})
		)
		.default([]),
	/** Se oculta del menu (recursos que solo se manejan desde su padre). */
	hidden: z.boolean().default(false),
	/** (registro) -> bool; por ejemplo los roles `system` no se editan ni se borran. */
	canEdit: fn.optional(),
	canDelete: fn.optional(),
	/** (pb) -> { create?(data, files), update?(id, data, files) } para reglas propias. */
	service: fn.optional()
});

/** Valida la definicion de un recurso y la congela. Lanza si esta mal formada. */
export function defineResource(config) {
	const resource = resourceSchema.parse(config);
	const fieldNames = new Set(resource.fields.map((f) => f.name));
	for (const f of resource.fields) {
		if (['relation', 'relations', 'groups'].includes(f.type) && !f.options) {
			throw new Error(
				`Recurso "${resource.name}": el campo "${f.name}" (${f.type}) necesita options`
			);
		}
	}
	for (const filter of resource.filters) {
		if (!fieldNames.has(filter.name) && filter.type === 'relation') {
			throw new Error(`Recurso "${resource.name}": el filtro "${filter.name}" no es un campo`);
		}
	}
	return Object.freeze({ ...resource, collection: resource.collection ?? resource.name });
}

/**
 * Reune los recursos de todos los modulos. Falla si un nombre se repite, si un permiso no esta
 * declarado en algun modulo (un typo dejaria el recurso sin proteccion real) o si un hijo apunta
 * a un recurso que no existe.
 */
export function collectResources(modules) {
	const declared = new Set(modules.flatMap((m) => m.permissions.map((p) => p.code)));
	const byName = new Map();
	for (const mod of modules) {
		for (const resource of mod.resources) {
			if (byName.has(resource.name)) {
				throw new Error(`Recurso duplicado "${resource.name}"`);
			}
			for (const code of Object.values(resource.permissions)) {
				if (!declared.has(code)) {
					throw new Error(
						`Recurso "${resource.name}": el permiso "${code}" no esta declarado en ningun modulo`
					);
				}
			}
			byName.set(resource.name, { ...resource, module: mod.name, moduleLabel: mod.label });
		}
	}
	for (const resource of byName.values()) {
		for (const child of resource.children) {
			const target = byName.get(child.resource);
			if (!target) {
				throw new Error(`Recurso "${resource.name}": el hijo "${child.resource}" no existe`);
			}
			if (!target.filters.some((f) => f.name === child.foreignKey && f.type === 'relation')) {
				throw new Error(
					`Recurso "${target.name}" debe declarar el filtro "${child.foreignKey}" para listarse como hijo de "${resource.name}"`
				);
			}
		}
	}
	return byName;
}

/** Version serializable (sin funciones ni schemas) para mandar al navegador. */
export function describeResource(resource) {
	return {
		name: resource.name,
		label: resource.label,
		feminine: resource.feminine,
		titleField: resource.titleField,
		columns: resource.columns,
		fields: resource.fields.map(({ options, ...field }) => ({
			...field,
			grouped: !!options?.group
		})),
		filters: resource.filters,
		hasSearch: resource.search.length > 0
	};
}

/**
 * Menu del admin: [{ label: modulo, items: [{ label, href }] }] con lo que el usuario puede ver.
 * Una entrada por recurso con permiso de lectura (salvo los ocultos) mas las `nav` del manifiesto.
 */
export function buildNav(modules, resources, permissions, hrefFor) {
	const can = (code) => permissions.has(code);
	const groups = [];
	for (const mod of modules) {
		const items = [];
		for (const resource of resources.values()) {
			if (resource.module !== mod.name || resource.hidden) continue;
			if (can(resource.permissions.read)) {
				items.push({ label: resource.label[1], href: hrefFor(resource.name) });
			}
		}
		for (const entry of mod.nav) {
			if (!entry.permission || can(entry.permission))
				items.push({ label: entry.label, href: entry.href });
		}
		if (items.length) groups.push({ label: mod.label, items });
	}
	return groups;
}
