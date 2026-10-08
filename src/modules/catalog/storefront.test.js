import { describe, expect, it } from 'vitest';
import { pricingConfig } from '#core/pricing.js';
import { availabilityOf, createStorefront, toProductCard, toPublicVariant } from './storefront.js';

const config = {
	applyIva: true,
	ivaBp: 1600,
	applyFee: true,
	feeBp: 290,
	feeFixed: 0,
	discountNonCard: true
};
const product = {
	id: 'prod1aaaaaaaaaa',
	slug: 'camiseta',
	name: 'Camiseta',
	images: ['a.png'],
	expand: { category: { name: 'Camisetas' } }
};
const ov = (id, value, option, sort = 0) => ({
	id,
	value,
	option: `o-${option}`,
	sort,
	expand: { option: { name: option, sort: option === 'Talla' ? 0 : 1 } }
});
const raw = (id, price, stock, values) => ({ id, price, stock, image: '', expand: { values } });

describe('availabilityOf', () => {
	it('agotado, pocas piezas y disponible', () => {
		expect([availabilityOf(0), availabilityOf(3), availabilityOf(5), availabilityOf(6)]).toEqual([
			'out',
			'low',
			'low',
			'in'
		]);
	});
});

describe('toPublicVariant', () => {
	const v = toPublicVariant(
		raw('v1', 100_000, 40, [ov('s', 'S', 'Talla'), ov('n', 'Negro', 'Color')]),
		config,
		product
	);
	it('etiqueta, opciones ordenadas y existencias acotadas', () => {
		expect(v.label).toBe('S / Negro');
		expect(v.options.map((o) => o.option)).toEqual(['Talla', 'Color']);
		expect(v.stock).toBe(10); // no se revela el stock real
		expect(v.availability).toBe('in');
	});
	it('hereda la imagen del producto y muestra solo precios finales por metodo', () => {
		expect(v.image).toBe('/media/products/prod1aaaaaaaaaa/a.png?thumb=480x480');
		expect(v.prices).toMatchObject({ card: 120_711, other: 116_000, saves: 4711 });
	});
	it('NO expone el precio base, la comision ni el neto', () => {
		const json = JSON.stringify(v);
		expect(json).not.toContain('100000');
		for (const word of ['clip', 'fee', 'net', 'comision', 'base'])
			expect(json.toLowerCase()).not.toContain(word);
	});
});

describe('toProductCard', () => {
	const mk = (id, price, stock) => toPublicVariant(raw(id, price, stock, []), config, product);
	it('precio "desde" entre las variantes disponibles', () => {
		const card = toProductCard(product, [
			mk('a', 100_000, 5),
			mk('b', 50_000, 5),
			mk('c', 10_000, 0)
		]);
		expect(card.from.card).toBe(
			toPublicVariant(raw('x', 50_000, 1, []), config, product).prices.card
		);
		expect(card.multiplePrices).toBe(true);
		expect(card.availability).toBe('low');
		expect(card.href).toBe('/productos/camiseta');
	});
	it('sin variantes con stock: agotado, y sin variantes: sin precio', () => {
		expect(toProductCard(product, [mk('a', 1000, 0)]).availability).toBe('out');
		const none = toProductCard(product, []);
		expect(none.from).toBeNull();
		expect(none.availability).toBe('out');
	});
});

function fakePb({ products = [], variants = [], categories = [] } = {}) {
	const calls = [];
	const lists = { products, variants, categories };
	return {
		calls,
		filter: (expr, params) => `${expr} ${JSON.stringify(params ?? {})}`,
		collection: (name) => ({
			getList: async (page, perPage, opts) => (
				calls.push([name, 'getList', opts]),
				{ items: lists[name], page, totalPages: 1, totalItems: lists[name].length }
			),
			getFullList: async (opts) => (calls.push([name, 'getFullList', opts]), lists[name]),
			getFirstListItem: async (filter) => {
				calls.push([name, 'first', filter]);
				const found = lists[name][0];
				if (!found) throw Object.assign(new Error('nf'), { status: 404 });
				return found;
			}
		})
	};
}

describe('createStorefront', () => {
	it('listProducts: filtros parametrizados y siempre solo activos', async () => {
		const pb = fakePb({
			products: [{ ...product }],
			variants: [{ ...raw('v1', 1000, 3, []), product: product.id, active: true }]
		});
		const res = await createStorefront(
			pb,
			pricingConfig({
				'tax.apply_iva': true,
				'tax.iva_rate': 16,
				'clip.apply_fee': false,
				'clip.fee_rate': 2.9,
				'clip.fee_fixed': 0,
				'pricing.discount_non_card': true
			})
		).listProducts({ q: 'gor"ra' });
		const call = pb.calls.find((c) => c[0] === 'products' && c[1] === 'getList');
		expect(call[2].filter).toContain('active = true');
		expect(call[2].filter).toContain('"q":"gor\\"ra"'); // enlazado como parametro, nunca concatenado
		expect(res.items).toHaveLength(1);
	});
	it('listProducts de una categoria inexistente devuelve vacio', async () => {
		const res = await createStorefront(fakePb(), config).listProducts({ categorySlug: 'nada' });
		expect(res).toMatchObject({ items: [], totalItems: 0, category: null });
	});
	it('getProduct: null si no existe y descripcion saneada', async () => {
		expect(await createStorefront(fakePb(), config).getProduct('nada')).toBeNull();
		const pb = fakePb({
			products: [{ ...product, description: '<p>Hola</p><script>alert(1)</script>' }]
		});
		const p = await createStorefront(pb, config).getProduct('camiseta');
		expect(p.descriptionHtml).toBe('<p>Hola</p>');
		expect(p.summary).toBe('Hola');
		expect(p.variants).toEqual([]);
	});
});
