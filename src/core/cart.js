import { z } from 'zod';

/**
 * Carrito de la tienda web: una cookie con [{ v: id de variante, q: cantidad }]. Solo guarda ids y
 * cantidades; precios, stock y disponibilidad se leen SIEMPRE de la base al mostrar o cobrar, asi que
 * manipular la cookie no sirve de nada.
 */
export const CART_COOKIE = 'cart';
export const CART_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	maxAge: 60 * 60 * 24 * 30
};
export const MAX_LINES = 40;
export const MAX_QTY = 99;

const lineSchema = z.object({
	v: z.string().regex(/^[a-z0-9]{15}$/),
	q: z.number().int().min(1).max(MAX_QTY)
});

/** Cookie -> [{ variant, qty }]. Cualquier cosa rara se descarta (carrito vacio), nunca lanza. */
export function parseCart(raw) {
	if (!raw) return [];
	try {
		const parsed = z.array(lineSchema).max(MAX_LINES).safeParse(JSON.parse(raw));
		if (!parsed.success) return [];
		return mergeLines(parsed.data.map((l) => ({ variant: l.v, qty: l.q })));
	} catch {
		return [];
	}
}

export const serializeCart = (lines) =>
	JSON.stringify(lines.map((l) => ({ v: l.variant, q: l.qty })));

function mergeLines(lines) {
	const byVariant = new Map();
	for (const { variant, qty } of lines) {
		byVariant.set(variant, Math.min(MAX_QTY, (byVariant.get(variant) ?? 0) + qty));
	}
	return [...byVariant].map(([variant, qty]) => ({ variant, qty }));
}

/** Agrega `qty` de una variante (suma si ya estaba). */
export function addLine(lines, variant, qty = 1) {
	const next = mergeLines([...lines, { variant, qty }]);
	return next.slice(0, MAX_LINES);
}

/** Fija la cantidad de una variante; 0 o menos la quita. */
export function setQty(lines, variant, qty) {
	if (!Number.isInteger(qty) || qty <= 0) return lines.filter((l) => l.variant !== variant);
	return lines.map((l) => (l.variant === variant ? { ...l, qty: Math.min(qty, MAX_QTY) } : l));
}

export const removeLine = (lines, variant) => lines.filter((l) => l.variant !== variant);
export const cartCount = (lines) => lines.reduce((sum, l) => sum + l.qty, 0);
