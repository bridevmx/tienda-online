/**
 * Dinero: una sola moneda (MXN), siempre en centavos enteros.
 * Nunca se guardan ni se operan montos como decimales.
 */

/** Pesos (numero o texto como "12.50") a centavos enteros. */
export function toCents(pesos) {
	const n = typeof pesos === 'string' ? Number(pesos.replace(/[$,\s]/g, '')) : pesos;
	if (!Number.isFinite(n)) throw new TypeError(`Monto invalido: ${pesos}`);
	return Math.round(n * 100);
}

const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** Centavos a texto con formato de moneda, ej. 120039 -> "$1,200.39". */
export function formatMoney(cents) {
	if (!Number.isInteger(cents)) throw new TypeError(`Los centavos deben ser enteros: ${cents}`);
	return formatter.format(cents / 100);
}
