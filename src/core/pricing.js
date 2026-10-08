/**
 * PRECIOS: una sola funcion pura que usan la pagina de producto, el carrito, el checkout y el TPV,
 * para que el precio mostrado y el cobrado nunca difieran. Todo en centavos enteros (MXN) y tasas
 * en puntos base (16 % = 1600); los calculos usan BigInt para no perder precision.
 *
 * El precio guardado en el catalogo es lo que la tienda quiere recibir NETO (sin IVA ni comision).
 *
 *   k  = tasa_clip x (1 + IVA)      comision de Clip + el IVA de esa comision (siempre aplica)
 *   i  = IVA de venta si esta activo, si no 0
 *   B  = (precio + fijo x (1 + IVA)) / (1 - k x (1 + i))      subtotal de lista (comision incluida)
 *   IVA venta = B x i ;  total con tarjeta = B + IVA venta
 *
 * Con efectivo o transferencia (y `discountNonCard`) el cliente recibe un descuento B - precio, y el
 * IVA se calcula sobre lo ya descontado. Los montos se redondean hacia arriba al centavo para que a
 * la tienda nunca le falte. VALIDAR el tratamiento fiscal con el contador (ver docs/PLAN.md).
 *
 * `customerView` es lo UNICO que puede llegar al cliente; `internal` (comision, neto) es solo para
 * el personal. El cliente nunca ve la comision.
 */

export const PAYMENT_METHODS = ['cash', 'transfer', 'card_clip'];

const BP = 10_000n;
const ceilDiv = (a, b) => (a + b - 1n) / b;
const roundDiv = (a, b) => (a + b / 2n) / b;

/** Config de precios a partir de los ajustes tipados (ver modules/settings). */
export function pricingConfig(settings) {
	return {
		applyIva: !!settings['tax.apply_iva'],
		ivaBp: Math.round(Number(settings['tax.iva_rate']) * 100),
		applyFee: !!settings['clip.apply_fee'],
		feeBp: Math.round(Number(settings['clip.fee_rate']) * 100),
		feeFixed: Number(settings['clip.fee_fixed']) || 0,
		discountNonCard: !!settings['pricing.discount_non_card']
	};
}

function assertCents(value, name) {
	if (!Number.isSafeInteger(value) || value < 0)
		throw new RangeError(`${name} debe ser un entero >= 0 (centavos)`);
}

/** Subtotal de lista: el precio con la comision de Clip integrada (o el precio si no se integra). */
export function listSubtotal(baseCents, config) {
	assertCents(baseCents, 'baseCents');
	if (!config.applyFee) return baseCents;
	const sale = BigInt(config.applyIva ? config.ivaBp : 0);
	const feeIva = BigInt(config.ivaBp);
	const numerator = BigInt(baseCents) * BP + BigInt(config.feeFixed) * (BP + feeIva); // escala 1e4
	const denominator = BP ** 3n - BigInt(config.feeBp) * (BP + feeIva) * (BP + sale); // escala 1e12
	if (denominator <= 0n) throw new RangeError('La comision de Clip es demasiado alta');
	return Number(ceilDiv(numerator * BP ** 2n, denominator));
}

/**
 * Totales de una compra.
 * @param {object} input
 * @param {number} input.baseCents  suma de precios del catalogo (sin IVA ni comision)
 * @param {string|null} [input.method] 'card_clip' | 'transfer' | 'cash'; null = precio de lista (tarjeta)
 * @param {object} input.config     pricingConfig(...), ya con los overrides del simulador si los hay
 */
export function computeTotals({ baseCents, method = 'card_clip', config }) {
	assertCents(baseCents, 'baseCents');
	if (method !== null && !PAYMENT_METHODS.includes(method))
		throw new RangeError(`Metodo de pago desconocido: ${method}`);

	const saleBp = config.applyIva ? config.ivaBp : 0;
	const list = listSubtotal(baseCents, config);
	const isCard = method === null || method === 'card_clip';

	// quien no paga con tarjeta recibe como descuento la comision integrada en el precio
	const discount = !isCard && config.applyFee && config.discountNonCard ? list - baseCents : 0;
	const taxable = list - discount;
	const iva = Number(ceilDiv(BigInt(taxable) * BigInt(saleBp), BP));
	const total = taxable + iva;

	// lo que Clip descontara (estimado) si se paga con tarjeta; es un costo real aunque no se integre en el precio
	let clipFee = 0;
	let clipFeeIva = 0;
	if (isCard) {
		clipFee = Number(roundDiv(BigInt(total) * BigInt(config.feeBp), BP)) + config.feeFixed;
		clipFeeIva = Number(roundDiv(BigInt(clipFee) * BigInt(config.ivaBp), BP));
	}

	return {
		customerView: { subtotal: list, discount, iva, total },
		internal: {
			base: baseCents,
			clipFee,
			clipFeeIva,
			/** Lo que le queda a la tienda despues de IVA y comision de Clip. */
			net: total - iva - clipFee - clipFeeIva
		}
	};
}

/** Precios de lista por metodo (para mostrar "tarjeta" y "efectivo o transferencia" lado a lado). */
export function priceByMethod(baseCents, config) {
	const card = computeTotals({ baseCents, method: 'card_clip', config }).customerView;
	const other = computeTotals({ baseCents, method: 'transfer', config }).customerView;
	return { card, other, saves: card.total - other.total };
}

/**
 * Reparte `total` entre lineas en proporcion a `weights` sin perder ni inventar centavos (mayor
 * residuo): la suma de lo repartido es exactamente `total`.
 */
export function allocate(total, weights) {
	const sum = weights.reduce((a, b) => a + b, 0);
	if (!weights.length) return [];
	if (sum === 0) return weights.map((_, i) => (i === 0 ? total : 0));
	const shares = weights.map((w) => Math.floor((total * w) / sum));
	let left = total - shares.reduce((a, b) => a + b, 0);
	const order = weights
		.map((w, i) => ({ i, rest: (total * w) / sum - shares[i] }))
		.sort((a, b) => b.rest - a.rest || a.i - b.i);
	for (const { i } of order) {
		if (left <= 0) break;
		shares[i] += 1;
		left -= 1;
	}
	return shares;
}
