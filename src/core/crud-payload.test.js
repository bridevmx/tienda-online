import { describe, expect, it } from 'vitest';
import { saveRecord } from './crud-payload.js';

function fakePb({ failUpload = false } = {}) {
	const calls = [];
	const collection = (name) => ({
		create: async (data) => (calls.push(['create', name, data]), { id: 'new1' }),
		update: async (id, data) => {
			calls.push(['update', name, id, data]);
			if (failUpload && data instanceof FormData) throw new Error('mime');
			return { id };
		},
		delete: async (id) => void calls.push(['delete', name, id])
	});
	return { calls, collection };
}
const file = () => new File(['x'], 'a.png', { type: 'image/png' });

describe('saveRecord', () => {
	it('sin archivos: una sola llamada con los datos', async () => {
		const pb = fakePb();
		await saveRecord(pb, 'products', null, { name: 'x' });
		expect(pb.calls).toEqual([['create', 'products', { name: 'x' }]]);
	});
	it('con archivos: datos primero y archivos despues (campos multiples con +)', async () => {
		const pb = fakePb();
		await saveRecord(
			pb,
			'products',
			'p1',
			{ name: 'x' },
			{ uploads: { images: { files: [file()], append: true } } }
		);
		expect(pb.calls[0]).toEqual(['update', 'products', 'p1', { name: 'x' }]);
		const body = pb.calls[1][3];
		expect(body).toBeInstanceOf(FormData);
		expect([...body.keys()]).toEqual(['images+']);
	});
	it('un campo de un solo archivo reemplaza (sin +) y se pueden quitar archivos', async () => {
		const pb = fakePb();
		await saveRecord(
			pb,
			'categories',
			'c1',
			{},
			{
				uploads: { image: { files: [file()], append: false } },
				removals: { image: ['vieja.png'] }
			}
		);
		const body = pb.calls[1][3];
		expect([...body.keys()]).toEqual(['image', 'image-']);
		expect(body.get('image-')).toBe('vieja.png');
	});
	it('si falla la subida de un registro nuevo, lo borra', async () => {
		const pb = fakePb({ failUpload: true });
		await expect(
			saveRecord(
				pb,
				'products',
				null,
				{ name: 'x' },
				{ uploads: { images: { files: [file()], append: true } } }
			)
		).rejects.toThrow('mime');
		expect(pb.calls.at(-1)).toEqual(['delete', 'products', 'new1']);
	});
	it('si falla la subida al editar, no borra nada', async () => {
		const pb = fakePb({ failUpload: true });
		await expect(
			saveRecord(
				pb,
				'products',
				'p1',
				{},
				{ uploads: { images: { files: [file()], append: true } } }
			)
		).rejects.toThrow();
		expect(pb.calls.some((c) => c[0] === 'delete')).toBe(false);
	});
});
