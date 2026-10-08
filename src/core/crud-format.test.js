import { describe, expect, it } from 'vitest';
import { formatCell } from './crud-format.js';

describe('formatCell', () => {
	it('bool con etiquetas', () => {
		const col = { key: 'active', type: 'bool', labels: ['Activa', 'Inactiva'] };
		expect(formatCell(col, { active: true })).toEqual({
			type: 'badge',
			text: 'Activa',
			badge: 'primary'
		});
		expect(formatCell(col, { active: false })).toMatchObject({ text: 'Inactiva', badge: null });
		expect(formatCell({ key: 's', type: 'bool', labels: ['Sistema', ''] }, { s: false }).text).toBe(
			''
		);
	});
	it('codigo (SKU) en monoespaciado', () => {
		expect(formatCell({ key: 'sku', type: 'code' }, { sku: 'CAM-1' })).toMatchObject({
			text: 'CAM-1',
			mono: true
		});
	});
	it('dinero en pesos', () => {
		expect(formatCell({ key: 'price', type: 'money' }, { price: 24900 }).text).toMatch(/249\.00/);
	});
	it('stock: agotado en error, pocas piezas en info', () => {
		const col = { key: 'stock', type: 'stock' };
		expect(formatCell(col, { stock: 0 })).toMatchObject({ text: 'Agotado', badge: 'error' });
		expect(formatCell(col, { stock: 3 })).toMatchObject({ text: '3', badge: 'info' });
		expect(formatCell(col, { stock: 40 })).toMatchObject({ text: '40', badge: null });
	});
	it('relaciones expandidas', () => {
		const record = {
			expand: { category: { name: 'Hogar' }, values: [{ value: 'M' }, { value: 'Negro' }] }
		};
		expect(formatCell({ key: 'category', type: 'relation', labelKey: 'name' }, record).text).toBe(
			'Hogar'
		);
		expect(formatCell({ key: 'values', type: 'relations', labelKey: 'value' }, record).text).toBe(
			'M / Negro'
		);
		expect(formatCell({ key: 'category', type: 'relation' }, {}).text).toBe('');
	});
	it('conteo y fecha', () => {
		expect(formatCell({ key: 'p', type: 'count' }, { p: ['a', 'b'] }).text).toBe('2');
		expect(formatCell({ key: 'c', type: 'date' }, { c: '2026-10-08 05:04:54.960Z' }).text).toMatch(
			/oct/i
		);
	});
	it('imagen: URL de la app, nunca de PocketBase', () => {
		const cell = formatCell(
			{ key: 'images', type: 'image', thumb: '480x480' },
			{ id: 'rec', images: ['a.png', 'b.png'] },
			'products'
		);
		expect(cell.src).toBe('/media/products/rec/a.png?thumb=480x480');
		expect(
			formatCell({ key: 'images', type: 'image' }, { id: 'r', images: [] }, 'products').src
		).toBeNull();
	});
	it('los textos se devuelven tal cual (el escape es de Svelte)', () => {
		expect(formatCell({ key: 'name' }, { name: '<b>x</b>' }).text).toBe('<b>x</b>');
	});
});
