import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, resolveTheme } from './themes.js';

describe('resolveTheme', () => {
	it('acepta temas registrados', () => {
		expect(resolveTheme('tienda-noche')).toBe('tienda-noche');
	});
	it('cae al tema por defecto con valores desconocidos', () => {
		expect(resolveTheme('"><script>')).toBe(DEFAULT_THEME);
		expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
	});
});
