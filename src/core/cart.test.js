import { describe, expect, it } from 'vitest';
import {
	MAX_LINES,
	MAX_QTY,
	addLine,
	cartCount,
	parseCart,
	removeLine,
	serializeCart,
	setQty
} from './cart.js';

const a = 'aaaaaaaaaaaaaaa';
const b = 'bbbbbbbbbbbbbbb';

describe('parseCart / serializeCart', () => {
	it('ida y vuelta', () => {
		const lines = [
			{ variant: a, qty: 2 },
			{ variant: b, qty: 1 }
		];
		expect(parseCart(serializeCart(lines))).toEqual(lines);
	});
	it('descarta lo que no sea un carrito valido, sin lanzar', () => {
		for (const bad of [
			undefined,
			'',
			'no-json',
			'{}',
			'[1,2]',
			'[{"v":"x","q":1}]',
			`[{"v":"${a}","q":0}]`,
			`[{"v":"${a}","q":1.5}]`,
			`[{"v":"${a}","q":1000}]`
		]) {
			expect(parseCart(bad)).toEqual([]);
		}
	});
	it('limita el numero de lineas', () => {
		const many = Array.from({ length: MAX_LINES + 1 }, (_, i) => ({
			v: `${String(i).padStart(15, 'a')}`,
			q: 1
		}));
		expect(parseCart(JSON.stringify(many))).toEqual([]);
	});
	it('une variantes repetidas', () => {
		expect(parseCart(`[{"v":"${a}","q":2},{"v":"${a}","q":3}]`)).toEqual([{ variant: a, qty: 5 }]);
	});
});

describe('operaciones', () => {
	it('addLine suma y respeta el maximo', () => {
		expect(addLine([], a, 2)).toEqual([{ variant: a, qty: 2 }]);
		expect(addLine([{ variant: a, qty: 2 }], a, 3)).toEqual([{ variant: a, qty: 5 }]);
		expect(addLine([{ variant: a, qty: MAX_QTY }], a, 5)[0].qty).toBe(MAX_QTY);
	});
	it('setQty cambia, y 0 quita', () => {
		const lines = [
			{ variant: a, qty: 2 },
			{ variant: b, qty: 1 }
		];
		expect(setQty(lines, a, 7)[0].qty).toBe(7);
		expect(setQty(lines, a, 0)).toEqual([{ variant: b, qty: 1 }]);
		expect(setQty(lines, a, -3)).toHaveLength(1);
		expect(setQty(lines, a, 1000)[0].qty).toBe(MAX_QTY);
	});
	it('removeLine y cartCount', () => {
		const lines = [
			{ variant: a, qty: 2 },
			{ variant: b, qty: 3 }
		];
		expect(removeLine(lines, a)).toEqual([{ variant: b, qty: 3 }]);
		expect(cartCount(lines)).toBe(5);
		expect(cartCount([])).toBe(0);
	});
});
