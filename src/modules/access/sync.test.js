import { describe, expect, it } from 'vitest';
import { syncPermissions } from './sync.js';

/** PocketBase en memoria: solo lo que usa syncPermissions (getFullList, create, update, delete). */
function fakePb() {
	let n = 0;
	const db = { permissions: [], roles: [] };
	const collection = (name) => ({
		getFullList: async () => db[name].map((r) => structuredClone(r)),
		create: async (data) => {
			const rec = { id: `${name}_${++n}`, ...structuredClone(data) };
			db[name].push(rec);
			return structuredClone(rec);
		},
		update: async (id, data) => {
			const rec = db[name].find((r) => r.id === id);
			for (const [key, value] of Object.entries(data)) {
				if (key.endsWith('+')) rec[key.slice(0, -1)] = [...(rec[key.slice(0, -1)] ?? []), ...value];
				else rec[key] = value;
			}
			return structuredClone(rec);
		},
		delete: async (id) => {
			db[name] = db[name].filter((r) => r.id !== id);
			for (const role of db.roles) role.permissions = role.permissions?.filter((p) => p !== id);
		}
	});
	return { db, collection };
}

const def = (code, roles = []) => ({ code, description: code, module: 'm', roles });
const defs = [def('a:read', ['cajero']), def('a:write', ['gerente']), def('a:delete')];
const codesOf = (pb, slug) => {
	const role = pb.db.roles.find((r) => r.slug === slug);
	return role.permissions.map((id) => pb.db.permissions.find((p) => p.id === id).code).sort();
};

describe('syncPermissions', () => {
	it('crea permisos, roles base y otorga por defecto; admin recibe todo', async () => {
		const pb = fakePb();
		const s = await syncPermissions(pb, defs);
		expect(s.created).toHaveLength(3);
		expect(s.rolesCreated.sort()).toEqual(['admin', 'cajero', 'gerente']);
		expect(codesOf(pb, 'admin')).toEqual(['a:delete', 'a:read', 'a:write']);
		expect(codesOf(pb, 'cajero')).toEqual(['a:read']);
		expect(codesOf(pb, 'gerente')).toEqual(['a:write']);
		expect(pb.db.roles.find((r) => r.slug === 'admin').system).toBe(true);
	});

	it('es idempotente', async () => {
		const pb = fakePb();
		await syncPermissions(pb, defs);
		const s = await syncPermissions(pb, defs);
		expect(s.created).toEqual([]);
		expect(s.rolesCreated).toEqual([]);
		expect(s.grants).toEqual({});
	});

	it('no pisa los cambios hechos en la app', async () => {
		const pb = fakePb();
		await syncPermissions(pb, defs);
		// el admin le quita a cajero 'a:read'
		pb.db.roles.find((r) => r.slug === 'cajero').permissions = [];
		await syncPermissions(pb, defs);
		expect(codesOf(pb, 'cajero')).toEqual([]);
	});

	it('un permiso nuevo llega a sus roles por defecto y a admin', async () => {
		const pb = fakePb();
		await syncPermissions(pb, defs);
		const s = await syncPermissions(pb, [...defs, def('b:read', ['cajero'])]);
		expect(s.created).toEqual(['b:read']);
		expect(codesOf(pb, 'cajero')).toContain('b:read');
		expect(codesOf(pb, 'admin')).toContain('b:read');
		expect(codesOf(pb, 'gerente')).not.toContain('b:read');
	});

	it('admin recupera permisos que le falten', async () => {
		const pb = fakePb();
		await syncPermissions(pb, defs);
		pb.db.roles.find((r) => r.slug === 'admin').permissions = [];
		await syncPermissions(pb, defs);
		expect(codesOf(pb, 'admin')).toHaveLength(3);
	});

	it('reporta permisos obsoletos y solo los borra con prune', async () => {
		const pb = fakePb();
		await syncPermissions(pb, defs);
		const kept = await syncPermissions(pb, defs.slice(0, 2));
		expect(kept.stale).toEqual(['a:delete']);
		expect(pb.db.permissions).toHaveLength(3);
		const pruned = await syncPermissions(pb, defs.slice(0, 2), { prune: true });
		expect(pruned.pruned).toEqual(['a:delete']);
		expect(pb.db.permissions).toHaveLength(2);
	});
});
