import { describe, expect, it } from 'vitest';
import { tokenMaxAge, tokenSubject } from './auth.js';

const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
const now = Date.UTC(2026, 0, 1);
const exp = (offsetSeconds) => Math.floor(now / 1000) + offsetSeconds;

describe('tokenSubject', () => {
	it('devuelve el id si el token no ha expirado', () => {
		expect(tokenSubject(jwt({ id: 'abc', exp: exp(60) }), now)).toBe('abc');
	});
	it('devuelve null si expiro o esta mal formado', () => {
		expect(tokenSubject(jwt({ id: 'abc', exp: exp(-1) }), now)).toBeNull();
		expect(tokenSubject('basura', now)).toBeNull();
		expect(tokenSubject(undefined, now)).toBeNull();
		expect(tokenSubject(jwt({ exp: exp(60) }), now)).toBeNull();
	});
});

describe('tokenMaxAge', () => {
	it('calcula los segundos restantes', () => {
		expect(tokenMaxAge(jwt({ id: 'a', exp: exp(90) }), now)).toBe(90);
	});
	it('no es negativo', () => {
		expect(tokenMaxAge(jwt({ id: 'a', exp: exp(-5) }), now)).toBe(0);
		expect(tokenMaxAge('x', now)).toBe(0);
	});
});
