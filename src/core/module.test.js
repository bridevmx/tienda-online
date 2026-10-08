import { describe, expect, it } from 'vitest';
import { collectPermissions, defineModule } from './module.js';

const catalog = defineModule({
	name: 'catalog',
	label: 'Catalogo',
	permissions: [{ code: 'products:update', description: 'Editar productos' }]
});

describe('defineModule', () => {
	it('aplica valores por defecto', () => {
		expect(catalog.nav).toEqual([]);
		expect(catalog.resources).toEqual([]);
	});
	it('rechaza codigos de permiso mal formados', () => {
		expect(() =>
			defineModule({
				name: 'x',
				label: 'X',
				permissions: [{ code: 'Products.Update', description: 'x' }]
			})
		).toThrow();
	});
});

describe('collectPermissions', () => {
	it('aplana y marca el modulo de origen', () => {
		expect(collectPermissions([catalog])).toEqual([
			{ code: 'products:update', description: 'Editar productos', roles: [], module: 'catalog' }
		]);
	});
	it('falla con permisos duplicados', () => {
		const other = defineModule({
			name: 'other',
			label: 'Otro',
			permissions: [{ code: 'products:update', description: 'dup' }]
		});
		expect(() => collectPermissions([catalog, other])).toThrow(/duplicado/);
	});
});
