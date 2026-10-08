import { describe, expect, it } from 'vitest';
import { findTimestampViolations } from '../../scripts/check-schema.js';
import { enabled, su } from './support.js';

describe.skipIf(!enabled)('esquema de PocketBase', () => {
	it('toda coleccion termina con created y updated (convencion del proyecto)', async () => {
		const collections = await (await su()).collections.getFullList();
		expect(findTimestampViolations(collections)).toEqual([]);
	});

	it('las colecciones de ventas no aceptan escrituras de usuarios por la API', async () => {
		const collections = await (await su()).collections.getFullList();
		for (const name of ['orders', 'order_items', 'order_financials', 'payments']) {
			const c = collections.find((x) => x.name === name);
			expect(c, name).toBeTruthy();
			expect([c.createRule, c.updateRule, c.deleteRule], name).toEqual([null, null, null]);
		}
		const fin = collections.find((x) => x.name === 'order_financials');
		expect(fin.listRule, 'finanzas solo para personal').toMatch(/collectionName = "users"/);
		expect(fin.listRule).not.toMatch(/customers/);
	});
});
