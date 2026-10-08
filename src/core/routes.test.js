import { describe, expect, it } from 'vitest';
import { routes } from './routes.js';

describe('routes', () => {
	it('construye rutas estandar', () => {
		expect(routes.product('camisa-roja')).toBe('/productos/camisa-roja');
		expect(routes.admin.edit('products', 'abc123')).toBe('/admin/products/abc123');
		expect(routes.admin.create('categories')).toBe('/admin/categories/nuevo');
		expect(routes.webhooks.clip()).toBe('/api/webhooks/clip');
	});
	it('construye URLs de archivos', () => {
		expect(routes.media('products', 'abc', 'foto.png')).toBe('/media/products/abc/foto.png');
		expect(routes.media('products', 'abc', 'foto.png', '480x480')).toBe(
			'/media/products/abc/foto.png?thumb=480x480'
		);
	});
	it('escapa segmentos dinamicos', () => {
		expect(routes.product('a/b?c')).toBe('/productos/a%2Fb%3Fc');
	});
	it('agrega el token solo cuando existe', () => {
		expect(routes.order('W-1')).toBe('/pedido/W-1');
		expect(routes.order('W-1', 'tok')).toBe('/pedido/W-1?t=tok');
	});
});
