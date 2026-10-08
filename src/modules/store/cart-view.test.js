import { describe, expect, it } from 'vitest';
import { buildCart } from './cart-view.js';

const config = {
	applyIva: true,
	ivaBp: 1600,
	applyFee: true,
	feeBp: 290,
	feeFixed: 0,
	discountNonCard: true
};
const product = { id: 'p1', slug: 'gorra', name: 'Gorra', active: true, images: ['g.png'] };
const row = (id, price, stock, extra = {}) => ({
	id,
	sku: id.toUpperCase(),
	price,
	stock,
	image: '',
	active: true,
	expand: {
		product,
		values: [{ id: 'c', value: 'Negro', expand: { option: { name: 'Color', sort: 0 } } }]
	},
	...extra
});
const fakePb = (rows) => ({
	filter: (e, p) => `${e}${p ? JSON.stringify(p) : ''}`,
	collection: () => ({ getFullList: async () => rows })
});
const lines = (...l) => l.map(([variant, qty]) => ({ variant, qty }));

describe('buildCart', () => {
	it('carrito vacio', async () => {
		const { view } = await buildCart(fakePb([]), [], config);
		expect(view).toMatchObject({ empty: true, canCheckout: false, count: 0 });
	});

	it('calcula totales de lista y ahorro por pagar en efectivo o transferencia', async () => {
		const { view, server } = await buildCart(
			fakePb([row('v1', 100_000, 5)]),
			lines(['v1', 1]),
			config
		);
		expect(view.totals).toEqual({ subtotal: 104_061, discount: 0, iva: 16_650, total: 120_711 });
		expect(view.savings).toBe(4711);
		expect(view.canCheckout).toBe(true);
		expect(server.baseTotal).toBe(100_000);
		expect(view.lines[0]).toMatchObject({
			name: 'Gorra',
			label: 'Color: Negro',
			qty: 1,
			amount: 120_711
		});
	});

	it('las lineas (con IVA incluido) suman exactamente el total', async () => {
		const rows = [row('v1', 24_900, 9), row('v2', 59_900, 9), row('v3', 19_900, 9)];
		const { view } = await buildCart(fakePb(rows), lines(['v1', 1], ['v2', 2], ['v3', 3]), config);
		expect(view.lines.reduce((s, l) => s + l.amount, 0)).toBe(view.totals.total);
	});

	it('marca problemas y bloquea el pago, sin tocar el carrito', async () => {
		const rows = [row('v1', 1000, 2), row('v2', 1000, 0)];
		const { view } = await buildCart(
			fakePb(rows),
			lines(['v1', 5], ['v2', 1], ['gone', 1]),
			config
		);
		expect(view.lines.map((l) => l.problem)).toEqual(['stock', 'out', 'unavailable']);
		expect(view.canCheckout).toBe(false);
		expect(view.lines[2].name).toBe('Producto no disponible');
	});

	it('un producto inactivo cuenta como no disponible', async () => {
		const inactive = row('v1', 1000, 5, {
			expand: { product: { ...product, active: false }, values: [] }
		});
		const { view } = await buildCart(fakePb([inactive]), lines(['v1', 1]), config);
		expect(view.lines[0].problem).toBe('unavailable');
	});

	it('view no contiene precio base ni comision (solo server)', async () => {
		const { view, server } = await buildCart(
			fakePb([row('v1', 100_000, 5)]),
			lines(['v1', 1]),
			config
		);
		const json = JSON.stringify(view);
		expect(json).not.toContain('100000');
		for (const word of ['unitBase', 'baseTotal', 'clipFee', 'net', 'internal'])
			expect(json).not.toContain(word);
		expect(server.totals.internal.net).toBe(100_000);
	});

	it('con metodo efectivo muestra el descuento', async () => {
		const { view } = await buildCart(fakePb([row('v1', 100_000, 5)]), lines(['v1', 1]), config, {
			method: 'cash'
		});
		expect(view.totals).toEqual({ subtotal: 104_061, discount: 4061, iva: 16_000, total: 116_000 });
	});
});
