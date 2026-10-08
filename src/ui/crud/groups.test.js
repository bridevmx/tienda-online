import { describe, expect, it } from 'vitest';
import { groupOptions } from './groups.js';

describe('groupOptions', () => {
	it('agrupa en orden de aparicion', () => {
		const list = [
			{ value: '1', group: { key: 'a', label: 'Talla' } },
			{ value: '2', group: { key: 'b', label: 'Color' } },
			{ value: '3', group: { key: 'a', label: 'Talla' } }
		];
		const groups = groupOptions(list);
		expect(groups.map((g) => g.label)).toEqual(['Talla', 'Color']);
		expect(groups[0].items.map((o) => o.value)).toEqual(['1', '3']);
	});
	it('sin grupo devuelve uno solo', () => {
		expect(groupOptions([{ value: '1' }, { value: '2' }])).toHaveLength(1);
		expect(groupOptions([])).toEqual([]);
	});
});
