import { describe, expect, it } from 'vitest';
import { makePaymentReference, parsePaymentReference } from './reference.js';

const SECRET = 'un-secreto-largo-de-prueba-0123456789';
const ID = 'abc123def456ghi';

describe('referencia de pago', () => {
	it('cabe en 36 caracteres y se reconoce', () => {
		const ref = makePaymentReference(SECRET, ID);
		expect(ref.length).toBeLessThanOrEqual(36);
		expect(ref).toMatch(/^TDA-abc123def456ghi-[A-Za-z0-9]{8}$/);
		expect(parsePaymentReference(SECRET, ref)).toBe(ID);
	});
	it('es estable por pago y distinta entre pagos', () => {
		expect(makePaymentReference(SECRET, ID)).toBe(makePaymentReference(SECRET, ID));
		expect(makePaymentReference(SECRET, ID)).not.toBe(
			makePaymentReference(SECRET, 'zzz123def456ghi')
		);
	});
	it('rechaza firma alterada, otro secreto, otro id y basura', () => {
		const ref = makePaymentReference(SECRET, ID);
		expect(
			parsePaymentReference(SECRET, ref.slice(0, -1) + (ref.endsWith('a') ? 'b' : 'a'))
		).toBeNull();
		expect(parsePaymentReference('otro-secreto', ref)).toBeNull();
		expect(parsePaymentReference(SECRET, ref.replace(ID, 'zzz123def456ghi'))).toBeNull();
		for (const bad of ['', null, undefined, 5, 'TDA-x-y', `${ref}x`, ` ${ref}`])
			expect(parsePaymentReference(SECRET, bad)).toBeNull();
		expect(parsePaymentReference('', ref)).toBeNull();
	});
	it('no firma sin secreto ni con id mal formado', () => {
		expect(() => makePaymentReference('', ID)).toThrow();
		expect(() => makePaymentReference(SECRET, 'corto')).toThrow();
	});
});
