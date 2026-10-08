import { describe, expect, it } from 'vitest';
import { checkoutReport, reportPasses } from './check.js';

const expected = { reference: 'TDA-x', amountCents: 100 };
const good = {
	status: 'paid',
	rawStatus: 'CHECKOUT_COMPLETED',
	reference: 'TDA-x',
	amountCents: 100,
	currency: 'MXN',
	receiptNo: 'R1'
};

describe('checkoutReport', () => {
	it('un pago completo y coincidente pasa todo', () => {
		expect(reportPasses(checkoutReport(good, expected))).toBe(true);
	});
	it.each([
		['sin completar', { status: 'pending', rawStatus: 'CHECKOUT_PENDING', receiptNo: null }],
		['otra referencia', { reference: 'otra' }],
		['otro monto', { amountCents: 101 }],
		['otra moneda', { currency: 'USD' }],
		['sin recibo', { receiptNo: null }]
	])('%s no pasa', (_n, change) => {
		expect(reportPasses(checkoutReport({ ...good, ...change }, expected))).toBe(false);
	});
	it('describe cada comprobacion', () => {
		const names = checkoutReport(good, expected).map((c) => c.name);
		expect(names).toEqual([
			'estado COMPLETADO',
			'referencia propia',
			'monto',
			'moneda MXN',
			'receipt_no presente'
		]);
	});
});
