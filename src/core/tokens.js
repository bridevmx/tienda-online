import { timingSafeEqual } from 'node:crypto';

/** Compara un token recibido con el esperado en tiempo constante. Sin token esperado, nada pasa. */
export function tokenMatches(given, expected) {
	if (!expected || typeof given !== 'string' || typeof expected !== 'string') return false;
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
