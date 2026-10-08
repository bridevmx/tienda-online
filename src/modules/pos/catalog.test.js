import { describe, expect, it } from 'vitest';
import { findByCode, matchItems } from './catalog.js';

const items = [
	{
		id: '1',
		sku: 'TAZ-CER',
		barcode: '750100',
		name: 'Taza de cerámica',
		label: 'Azul',
		category: 'c1'
	},
	{ id: '2', sku: 'GOR-NEG', barcode: '', name: 'Gorra', label: 'Negro / M', category: 'c2' }
];

describe('matchItems', () => {
	it('ignora acentos, mayúsculas y orden de palabras', () => {
		expect(matchItems(items, 'CERAMICA taza').map((i) => i.id)).toEqual(['1']);
		expect(matchItems(items, 'negro m').map((i) => i.id)).toEqual(['2']);
	});
	it('busca por SKU, código y categoría', () => {
		expect(matchItems(items, 'gor-neg')).toHaveLength(1);
		expect(matchItems(items, '7501')).toHaveLength(1);
		expect(matchItems(items, '', 'c2').map((i) => i.id)).toEqual(['2']);
	});
	it('sin texto devuelve todo', () => {
		expect(matchItems(items, '  ')).toHaveLength(2);
	});
});

describe('findByCode', () => {
	it('exacto por SKU o código de barras', () => {
		expect(findByCode(items, 'taz-cer')?.id).toBe('1');
		expect(findByCode(items, '750100')?.id).toBe('1');
		expect(findByCode(items, 'taz')).toBeNull();
		expect(findByCode(items, '')).toBeNull();
	});
});
