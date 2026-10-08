import { describe, expect, it } from 'vitest';
import { tokenMatches } from './tokens.js';

describe('tokenMatches', () => {
	it('solo el token exacto', () => {
		expect(tokenMatches('secreto', 'secreto')).toBe(true);
		for (const bad of ['otro', 'secret', 'secretoo', '', undefined, null, 5])
			expect(tokenMatches(bad, 'secreto')).toBe(false);
	});
	it('sin token esperado nada pasa (ni vacio contra vacio)', () => {
		expect(tokenMatches('', '')).toBe(false);
		expect(tokenMatches('x', undefined)).toBe(false);
	});
});
