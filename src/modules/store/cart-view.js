import { allocate, computeTotals } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { MAX_VISIBLE_STOCK, availabilityOf } from '#modules/catalog/storefront.js';

/**
 * Carrito para mostrar y para cobrar. Devuelve DOS cosas separadas a proposito:
 *   view   -> lo unico que puede ir al navegador (precios finales de lista, sin precio base ni comision)
 *   server -> lo que el checkout necesita (precios base, ids); nunca debe serializarse a una pagina
 *
 * Lo que no se puede comprar (variante inactiva/inexistente, stock insuficiente) se marca con
 * `problem` y bloquea el pago; el carrito nunca se "arregla" a escondidas.
 */
export async function buildCart(pb, lines, config, { method = 'card_clip' } = {}) {
	if (!lines.length) return emptyCart();

	const params = Object.fromEntries(lines.map((l, i) => [`v${i}`, l.variant]));
	const filter = pb.filter(lines.map((_, i) => `id = {:v${i}}`).join(' || '), params);
	const rows = await pb.collection('variants').getFullList({
		filter: pb.filter(`active = true && (${filter})`),
		expand: 'product,values.option'
	});
	const byId = new Map(rows.map((r) => [r.id, r]));

	const items = lines.map((line) => {
		const raw = byId.get(line.variant);
		if (!raw || raw.expand?.product?.active === false) {
			return { variant: line.variant, qty: line.qty, problem: 'unavailable', base: 0, unitBase: 0 };
		}
		const product = raw.expand.product;
		const options = (raw.expand?.values ?? [])
			.map((ov) => ({
				name: ov.expand?.option?.name ?? '',
				sort: ov.expand?.option?.sort ?? 0,
				value: ov.value
			}))
			.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
		const problem = raw.stock <= 0 ? 'out' : line.qty > raw.stock ? 'stock' : null;
		return {
			variant: raw.id,
			sku: raw.sku,
			qty: line.qty,
			problem,
			maxQty: Math.min(raw.stock, 99),
			available: raw.stock,
			productName: product.name,
			productSlug: product.slug,
			label: options.map((o) => `${o.name}: ${o.value}`).join(' · '),
			image: raw.image
				? routes.media('variants', raw.id, raw.image, '160x160')
				: product.images?.[0]
					? routes.media('products', product.id, product.images[0], '160x160')
					: null,
			unitBase: raw.price,
			base: raw.price * line.qty
		};
	});

	const valid = items.filter((i) => !i.problem);
	const baseTotal = items
		.filter((i) => i.problem !== 'unavailable')
		.reduce((sum, i) => sum + i.base, 0);
	const totals = computeTotals({ baseCents: baseTotal, method, config });
	const other = computeTotals({ baseCents: baseTotal, method: 'transfer', config });

	// el TOTAL (con IVA, como en la pagina de producto) se reparte entre las lineas para que sumen exactamente
	const priced = items.filter((i) => i.problem !== 'unavailable');
	const shares = allocate(
		totals.customerView.total,
		priced.map((i) => i.base)
	);
	const share = new Map(priced.map((item, idx) => [item.variant, shares[idx]]));

	const view = {
		empty: false,
		lines: items.map((i) => ({
			variant: i.variant,
			qty: i.qty,
			problem: i.problem,
			maxQty: i.maxQty,
			available: Math.min(i.available ?? 0, MAX_VISIBLE_STOCK),
			availability: i.available == null ? 'out' : availabilityOf(i.available),
			name: i.productName ?? 'Producto no disponible',
			href: i.productSlug ? routes.product(i.productSlug) : null,
			label: i.label ?? '',
			image: i.image ?? null,
			amount: share.get(i.variant) ?? 0
		})),
		totals: totals.customerView,
		savings: totals.customerView.total - other.customerView.total, // lo que se ahorra pagando en efectivo o transferencia
		canCheckout: valid.length === items.length,
		count: items.reduce((n, i) => n + i.qty, 0),
		method
	};
	const server = {
		method,
		baseTotal,
		items: items.map(({ variant, qty, unitBase, base, problem, sku, productName, label }) => ({
			variant,
			qty,
			unitBase,
			base,
			problem,
			sku,
			productName,
			label
		})),
		totals
	};
	return { view, server };
}

function emptyCart() {
	return {
		view: {
			empty: true,
			lines: [],
			totals: { subtotal: 0, discount: 0, iva: 0, total: 0 },
			savings: 0,
			canCheckout: false,
			count: 0,
			method: 'card_clip'
		},
		server: { method: 'card_clip', baseTotal: 0, items: [], totals: null }
	};
}
