import { describe, expect, it } from 'vitest';
import { summarize } from './queries.js';

describe('summarize', () => {
	const rows = [
		{
			channel: 'web',
			payment_method: 'card_clip',
			total: 120_711,
			discount: 0,
			tax_total: 16_650,
			created: '2026-10-08 10:00:00.000Z'
		},
		{
			channel: 'web',
			payment_method: 'transfer',
			total: 116_000,
			discount: 4061,
			tax_total: 16_000,
			created: '2026-10-08 12:00:00.000Z'
		},
		{
			channel: 'pos',
			payment_method: 'cash',
			total: 50_000,
			discount: 0,
			tax_total: 0,
			created: '2026-10-09 09:00:00.000Z'
		}
	];
	const s = summarize(rows);
	it('totales generales', () => {
		expect(s.all).toEqual({ count: 3, total: 286_711, discount: 4061, tax: 32_650 });
	});
	it('por canal, metodo y dia', () => {
		expect(s.byChannel.web).toMatchObject({ count: 2, total: 236_711 });
		expect(s.byChannel.pos.total).toBe(50_000);
		expect(s.byMethod.transfer.discount).toBe(4061);
		expect(Object.keys(s.byDay).sort()).toEqual(['2026-10-08', '2026-10-09']);
		expect(s.byDay['2026-10-08'].count).toBe(2);
	});
	it('sin filas', () => {
		expect(summarize([]).all.count).toBe(0);
	});
});
