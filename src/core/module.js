import { z } from 'zod';

/**
 * Un modulo es una carpeta en src/modules/<nombre> con un manifiesto (index.js) creado con
 * `defineModule`. El manifiesto es lo unico que se registra en src/modules/index.js: de el se
 * derivan el menu del admin, los permisos (npm run permissions:sync) y los recursos del CRUD.
 */
const permissionCode = z
	.string()
	.regex(/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/, 'formato modulo:accion');

const manifestSchema = z.object({
	name: z.string().regex(/^[a-z][a-z0-9_]*$/),
	label: z.string().min(1),
	/** Permisos que declara el modulo; se sincronizan a la coleccion `permissions`. */
	permissions: z
		.array(
			z.object({
				code: permissionCode,
				description: z.string().min(1),
				/** Roles que reciben este permiso por defecto cuando se crea (admin siempre los recibe). */
				roles: z.array(z.string()).default([])
			})
		)
		.default([]),
	/** Recursos que el admin genera automaticamente (ver CRUD generico, fase 3). */
	resources: z.array(z.object({ name: z.string().min(1) }).passthrough()).default([]),
	/** Entradas de menu del admin. */
	nav: z
		.array(
			z.object({
				label: z.string().min(1),
				href: z.string().startsWith('/'),
				permission: permissionCode.optional()
			})
		)
		.default([])
});

/** Valida y normaliza el manifiesto de un modulo. Lanza si es invalido. */
export function defineModule(manifest) {
	return Object.freeze(manifestSchema.parse(manifest));
}

/** Lista plana de permisos de todos los modulos; falla si un codigo se repite. */
export function collectPermissions(modules) {
	const seen = new Map();
	for (const mod of modules) {
		for (const perm of mod.permissions) {
			if (seen.has(perm.code)) {
				throw new Error(
					`Permiso duplicado "${perm.code}" en los modulos "${seen.get(perm.code)}" y "${mod.name}"`
				);
			}
			seen.set(perm.code, mod.name);
		}
	}
	return modules.flatMap((mod) => mod.permissions.map((p) => ({ ...p, module: mod.name })));
}
