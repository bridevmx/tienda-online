import { describe, expect, it } from 'vitest';
import { SLUG_PATTERN, slugify } from './slug.js';

describe('slugify', () => {
	it('quita acentos, espacios y simbolos', () => {
		expect(slugify('Camiseta básica')).toBe('camiseta-basica');
		expect(slugify('  Pantalón  de   mezclilla! ')).toBe('pantalon-de-mezclilla');
		expect(slugify('Ñandú & Co.')).toBe('nandu-co');
	});
	it('maneja vacio', () => {
		expect(slugify('')).toBe('');
		expect(slugify(undefined)).toBe('');
	});
	it('siempre produce algo que cumple SLUG_PATTERN (si no queda vacio)', () => {
		expect(SLUG_PATTERN.test(slugify('Hola Mundo 2'))).toBe(true);
	});
});
