import { SYSTEM_ROLES } from './index.js';

/**
 * Sincroniza los permisos declarados en los modulos con la base de datos. Es idempotente y NO
 * pisa lo que el admin edite en la app:
 *   - permisos nuevos: se crean y se otorgan a los roles de su lista `roles` (admin siempre).
 *   - permisos existentes: solo se actualiza su descripcion/modulo.
 *   - roles nuevos: se crean con los permisos que los listan como destino.
 *   - admin: siempre queda con todos los permisos.
 *   - permisos que ya no existen en el codigo: se reportan; solo se borran con { prune: true }.
 * `pb` debe ser un cliente de superusuario.
 */
export async function syncPermissions(pb, definitions, { prune = false } = {}) {
	const summary = { created: [], updated: [], stale: [], pruned: [], rolesCreated: [], grants: {} };
	const grant = (slug, code) => (summary.grants[slug] ??= []).push(code);

	// --- permisos ---
	const existing = new Map(
		(await pb.collection('permissions').getFullList()).map((p) => [p.code, p])
	);
	const idByCode = new Map();
	const createdCodes = new Set();

	for (const def of definitions) {
		const found = existing.get(def.code);
		if (!found) {
			const rec = await pb
				.collection('permissions')
				.create({ code: def.code, module: def.module, description: def.description });
			idByCode.set(def.code, rec.id);
			createdCodes.add(def.code);
			summary.created.push(def.code);
		} else {
			idByCode.set(def.code, found.id);
			if (found.module !== def.module || found.description !== def.description) {
				await pb
					.collection('permissions')
					.update(found.id, { module: def.module, description: def.description });
				summary.updated.push(def.code);
			}
		}
	}

	const known = new Set(definitions.map((d) => d.code));
	for (const [code, rec] of existing) {
		if (known.has(code)) continue;
		summary.stale.push(code);
		if (prune) {
			await pb.collection('permissions').delete(rec.id);
			summary.pruned.push(code);
		}
	}

	// --- roles ---
	const rolesBySlug = new Map((await pb.collection('roles').getFullList()).map((r) => [r.slug, r]));
	const newRoles = new Set();
	for (const def of SYSTEM_ROLES) {
		if (rolesBySlug.has(def.slug)) continue;
		const rec = await pb
			.collection('roles')
			.create({ name: def.name, slug: def.slug, system: def.system, permissions: [] });
		rolesBySlug.set(def.slug, { ...rec, permissions: [] });
		newRoles.add(def.slug);
		summary.rolesCreated.push(def.slug);
	}

	// --- otorgamientos ---
	const toAdd = new Map(); // slug -> codigos
	const want = (slug, code) => {
		if (!rolesBySlug.has(slug)) return;
		if (!toAdd.has(slug)) toAdd.set(slug, new Set());
		toAdd.get(slug).add(code);
	};
	for (const def of definitions) {
		const isNew = createdCodes.has(def.code);
		for (const slug of def.roles) {
			// permiso nuevo -> a sus roles por defecto; rol nuevo -> todos sus permisos por defecto
			if (isNew || newRoles.has(slug)) want(slug, def.code);
		}
		want('admin', def.code); // admin siempre tiene todo
	}
	for (const [slug, codes] of toAdd) {
		const role = rolesBySlug.get(slug);
		const has = new Set(role.permissions ?? []);
		const missing = [...codes].filter((code) => !has.has(idByCode.get(code)));
		if (!missing.length) continue;
		await pb
			.collection('roles')
			.update(role.id, { 'permissions+': missing.map((code) => idByCode.get(code)) });
		missing.forEach((code) => grant(slug, code));
	}

	return summary;
}
