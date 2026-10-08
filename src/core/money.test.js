import { describe, expect, it } from 'vitest';
import { formatMoney, toCents } from './money.js';

describe('toCents', () => {
	it('convierte numeros y texto', () => {
		expect(toCents(12.5)).toBe(1250);
		expect(toCents('$1,200.39')).toBe(120039);
		expect(toCents('0.1')).toBe(10);
	});
	it('rechaza valores no numericos', () => {
		expect(() => toCents('abc')).toThrow(TypeError);
	});
});

describe('formatMoney', () => {
	it('da formato MXN', () => {
		expect(formatMoney(120039)).toMatch(/1,200\.39/);
	});
	it('rechaza decimales', () => {
		expect(() => formatMoney(10.5)).toThrow(TypeError);
	});
});
