import { describe, expect, it } from 'vitest';
import { findTimestampViolations } from './check-schema.js';

const f = (name, type = 'text') => ({ name, type });
const ts = [f('created', 'autodate'), f('updated', 'autodate')];

describe('findTimestampViolations', () => {
	it('acepta colecciones con created/updated al final', () => {
		expect(findTimestampViolations([{ name: 'a', fields: [f('id'), f('x'), ...ts] }])).toEqual([]);
	});
	it('detecta campos despues de los timestamps', () => {
		const res = findTimestampViolations([{ name: 'a', fields: [f('id'), ...ts, f('late')] }]);
		expect(res).toHaveLength(1);
		expect(res[0].collection).toBe('a');
	});
	it('detecta colecciones sin timestamps o con otro tipo', () => {
		expect(findTimestampViolations([{ name: 'a', fields: [f('id'), f('x')] }])).toHaveLength(1);
		const wrong = [f('created'), f('updated')];
		expect(findTimestampViolations([{ name: 'a', fields: [f('id'), ...wrong] }])).toHaveLength(1);
	});
	it('ignora colecciones internas', () => {
		expect(findTimestampViolations([{ name: '_x', fields: [f('id')] }])).toEqual([]);
		expect(findTimestampViolations([{ name: 'y', system: true, fields: [f('id')] }])).toEqual([]);
	});
});
