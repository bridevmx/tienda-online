import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DomainError } from './errors.js';
import { createCrudService } from './crud.js';
import { defineResource } from './resource.js';

const resource = (extra = {}) =>
	defineResource({
		name: 'things',
		label: ['Cosa', 'Cosas'],
		permissions: { read: 'a:read', create: 'a:create', update: 'a:update', delete: 'a:delete' },
		schema: z.object({ name: z.string().min(1, 'falta') }),
		columns: [{ key: 'name', label: 'N' }],
		fields: [{ name: 'name', label: 'N', type: 'text' }],
		search: ['name'],
		...extra
	});

function fakePb({ deleteError } = {}) {
	const calls = [];
	return {
		calls,
		filter: (e, p) => `${e}|${JSON.stringify(p)}`,
		collection: () => ({
			getList: async (page, perPage, opts) => (
				calls.push(['getList', page, perPage, opts]),
				{ items: [{ id: '1' }], page, perPage, totalItems: 1, totalPages: 1 }
			),
			getOne: async (id) => {
				if (id === 'missing') throw Object.assign(new Error('nf'), { status: 404 });
				return { id };
			},
			create: async (d) => (calls.push(['create', d]), { id: 'n', ...d }),
			update: async (id, d) => (calls.push(['update', id, d]), { id, ...d }),
			delete: async () => {
				if (deleteError) throw Object.assign(new Error('x'), { status: deleteError });
			}
		})
	};
}

describe('createCrudService', () => {
	it('lista con filtro, orden y expand', async () => {
		const pb = fakePb();
		const res = await createCrudService(pb, resource({ expand: 'x' })).list({
			page: 2,
			perPage: 20,
			q: 'ab',
			sort: '-name',
			filters: {}
		});
		expect(res.totalItems).toBe(1);
		const [, page, perPage, opts] = pb.calls[0];
		expect([page, perPage, opts.sort, opts.expand]).toEqual([2, 20, '-name', 'x']);
		expect(opts.filter).toContain('name ~ {:q}');
	});
	it('get devuelve null si no existe', async () => {
		expect(await createCrudService(fakePb(), resource()).get('missing')).toBeNull();
		expect(await createCrudService(fakePb(), resource()).get('ok')).toEqual({ id: 'ok' });
	});
	it('valida antes de guardar y lanza DomainError con el campo', async () => {
		const pb = fakePb();
		const crud = createCrudService(pb, resource());
		await expect(crud.create({ name: '' })).rejects.toMatchObject({
			name: 'DomainError',
			field: 'name',
			message: 'falta'
		});
		expect(pb.calls.some((c) => c[0] === 'create')).toBe(false);
		expect((await crud.create({ name: 'x' })).name).toBe('x');
		expect((await crud.update('7', { name: 'y' })).id).toBe('7');
	});
	it('un service del recurso reemplaza create/update', async () => {
		const pb = fakePb();
		const crud = createCrudService(
			pb,
			resource({ service: () => ({ create: async (i) => ({ id: 'custom', ...i }) }) })
		);
		expect((await crud.create({ name: '' })).id).toBe('custom'); // su regla, no la del schema generico
		expect((await crud.update('7', { name: 'y' })).id).toBe('7'); // update sin override usa el generico
	});
	it('eliminar traduce los bloqueos de la base a un mensaje claro', async () => {
		for (const status of [400, 403, 404]) {
			const crud = createCrudService(fakePb({ deleteError: status }), resource());
			await expect(crud.remove('1')).rejects.toBeInstanceOf(DomainError);
		}
		const boom = createCrudService(fakePb({ deleteError: 500 }), resource());
		await expect(boom.remove('1')).rejects.not.toBeInstanceOf(DomainError);
		await expect(createCrudService(fakePb(), resource()).remove('1')).resolves.toBeUndefined();
	});
});
