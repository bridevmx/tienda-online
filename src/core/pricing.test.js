import { describe, expect, it } from 'vitest';
import { allocate, computeTotals, listSubtotal, priceByMethod, pricingConfig } from './pricing.js';

/** IVA 16 %, Clip 2.9 % + IVA, descuento por no pagar con tarjeta. */
const base = {
	applyIva: true,
	ivaBp: 1600,
	applyFee: true,
	feeBp: 290,
	feeFixed: 0,
	discountNonCard: true
};
const P = 100_000; // $1,000.00

const view = (config, method, cents = P) => computeTotals({ baseCents: cents, method, config });

describe('computeTotals: casos de referencia (docs/PLAN.md seccion 5)', () => {
	it('IVA + comision, tarjeta: 1,040.61 + 166.50 = 1,207.11 y a la tienda le quedan 1,000.00', () => {
		const t = view(base, 'card_clip');
		expect(t.customerView).toEqual({ subtotal: 104_061, discount: 0, iva: 16_650, total: 120_711 });
		expect(t.internal.net).toBe(P);
		expect(t.internal.clipFee + t.internal.clipFeeIva).toBe(4061); // $35.01 + $5.60 = $40.61
	});
	it('IVA + comision, efectivo o transferencia: descuento de 40.61 y total 1,160.00', () => {
		for (const method of ['cash', 'transfer']) {
			const t = view(base, method);
			expect(t.customerView).toEqual({
				subtotal: 104_061,
				discount: 4061,
				iva: 16_000,
				total: 116_000
			});
			expect(t.internal.net).toBe(116_000 - 16_000); // sin comision: queda el precio
			expect(t.internal.clipFee).toBe(0);
		}
	});
	it('solo comision (sin IVA): tarjeta 1,034.82 (redondeo hacia arriba); efectivo 1,000.00', () => {
		const config = { ...base, applyIva: false };
		const card = view(config, 'card_clip');
		expect(card.customerView).toEqual({ subtotal: 103_482, discount: 0, iva: 0, total: 103_482 });
		expect(card.internal.net).toBeGreaterThanOrEqual(P); // nunca menos (hasta 1 centavo de mas)
		expect(card.internal.net - P).toBeLessThanOrEqual(1);
		expect(view(config, 'transfer').customerView.total).toBe(P);
	});
	it('solo IVA (sin comision): 1,160.00 para todos los metodos', () => {
		const config = { ...base, applyFee: false };
		for (const method of ['cash', 'transfer', 'card_clip', null]) {
			expect(view(config, method).customerView).toEqual({
				subtotal: P,
				discount: 0,
				iva: 16_000,
				total: 116_000
			});
		}
	});
	it('sin IVA ni comision: el precio tal cual', () => {
		const config = { ...base, applyFee: false, applyIva: false };
		expect(view(config, 'card_clip').customerView.total).toBe(P);
	});
});

describe('computeTotals: reglas', () => {
	it('sin descuento por metodo: precio unico para todos', () => {
		const config = { ...base, discountNonCard: false };
		expect(view(config, 'cash').customerView).toEqual(view(config, 'card_clip').customerView);
		expect(view(config, 'cash').customerView.discount).toBe(0);
	});
	it('method null es el precio de lista (tarjeta)', () => {
		expect(view(base, null).customerView).toEqual(view(base, 'card_clip').customerView);
	});
	it('el cargo fijo de Clip tambien se integra y la tienda sigue recibiendo el precio', () => {
		const config = { ...base, feeFixed: 250 }; // $2.50
		const t = view(config, 'card_clip');
		expect(t.customerView.total).toBeGreaterThan(view(base, 'card_clip').customerView.total);
		expect(t.internal.net).toBeGreaterThanOrEqual(P);
		expect(t.internal.net - P).toBeLessThanOrEqual(2);
	});
	it('con tarjeta la comision se calcula aunque no este integrada en el precio (costo real)', () => {
		const t = view({ ...base, applyFee: false }, 'card_clip');
		expect(t.internal.clipFee).toBeGreaterThan(0);
		expect(t.internal.net).toBeLessThan(P);
	});
	it('total cero', () => {
		expect(view(base, 'card_clip', 0).customerView.total).toBe(0);
	});
	it('importes muy grandes no pierden precision', () => {
		const t = view(base, 'card_clip', 9_000_000_000); // $90 millones
		expect(Number.isSafeInteger(t.customerView.total)).toBe(true);
		expect(t.internal.net).toBeGreaterThanOrEqual(9_000_000_000);
	});
	it('el neto nunca es menor al precio con ninguna combinacion razonable', () => {
		for (const feeBp of [100, 290, 350, 499])
			for (const ivaBp of [0, 800, 1600])
				for (const applyIva of [true, false])
					for (const cents of [1, 99, 12_345, 99_999, 1_000_000]) {
						const config = { ...base, feeBp, ivaBp, applyIva };
						const t = view(config, 'card_clip', cents);
						expect(
							t.internal.net,
							JSON.stringify({ feeBp, ivaBp, applyIva, cents })
						).toBeGreaterThanOrEqual(cents - 2);
					}
	});
	it('rechaza entradas invalidas', () => {
		expect(() => view(base, 'bitcoin')).toThrow(/Metodo/);
		expect(() => view(base, 'cash', -1)).toThrow(RangeError);
		expect(() => view(base, 'cash', 10.5)).toThrow(RangeError);
		expect(() => listSubtotal(P, { ...base, feeBp: 9000 })).toThrow(/demasiado alta/);
	});
	it('customerView no contiene nada de la comision', () => {
		const keys = Object.keys(view(base, 'card_clip').customerView);
		expect(keys.sort()).toEqual(['discount', 'iva', 'subtotal', 'total']);
	});
});

describe('priceByMethod', () => {
	it('tarjeta vs efectivo o transferencia y cuanto se ahorra', () => {
		const p = priceByMethod(P, base);
		expect([p.card.total, p.other.total, p.saves]).toEqual([120_711, 116_000, 4711]);
	});
});

describe('pricingConfig', () => {
	it('convierte los ajustes (porcentajes) a puntos base', () => {
		expect(
			pricingConfig({
				'tax.apply_iva': true,
				'tax.iva_rate': 16,
				'clip.apply_fee': true,
				'clip.fee_rate': 2.9,
				'clip.fee_fixed': 250,
				'pricing.discount_non_card': false
			})
		).toEqual({
			applyIva: true,
			ivaBp: 1600,
			applyFee: true,
			feeBp: 290,
			feeFixed: 250,
			discountNonCard: false
		});
	});
});

describe('allocate', () => {
	it('reparte sin perder centavos', () => {
		expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
		expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b)).toBe(100);
		expect(allocate(104_061, [24_900, 59_900, 19_900]).reduce((a, b) => a + b)).toBe(104_061);
	});
	it('casos limite', () => {
		expect(allocate(50, [])).toEqual([]);
		expect(allocate(50, [0, 0])).toEqual([50, 0]);
		expect(allocate(0, [3, 4])).toEqual([0, 0]);
		expect(allocate(7, [1])).toEqual([7]);
	});
});
