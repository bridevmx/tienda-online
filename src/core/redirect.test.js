import { describe, expect, it } from 'vitest';
import { safeNext } from './redirect.js';

const admin = { prefix: '/admin', fallback: '/admin' };

describe('safeNext', () => {
	it('acepta rutas internas dentro del prefijo', () => {
		expect(safeNext('/admin/products?page=2', admin)).toBe('/admin/products?page=2');
		expect(safeNext('/admin', admin)).toBe('/admin');
		expect(safeNext('/admin?x=1', admin)).toBe('/admin?x=1');
	});
	it('rechaza destinos externos o ambiguos', () => {
		for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '/admin\n/x', null, '']) {
			expect(safeNext(bad, admin)).toBe('/admin');
		}
	});
	it('rechaza rutas fuera del prefijo, incluidos hermanos', () => {
		expect(safeNext('/cuenta', admin)).toBe('/admin');
		expect(safeNext('/administrador', admin)).toBe('/admin');
	});
	it('sin prefijo acepta cualquier ruta interna', () => {
		expect(safeNext('/cuenta', { fallback: '/' })).toBe('/cuenta');
	});
});
