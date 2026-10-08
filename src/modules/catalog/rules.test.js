import { describe, expect, it } from 'vitest';
import { DomainError } from '#core/errors.js';
import { checkCategoryParent, checkVariantOptions } from './rules.js';

describe('checkVariantOptions', () => {
	it('acepta la primera variante de un producto', () => {
		expect(() => checkVariantOptions(['talla', 'color'], [])).not.toThrow();
		expect(() => checkVariantOptions([], [])).not.toThrow(); // producto simple
	});
	it('acepta variantes con las mismas opciones, en cualquier orden', () => {
		expect(() => checkVariantOptions(['color', 'talla'], [['talla', 'color']])).not.toThrow();
	});
	it('rechaza dos valores de la misma opcion', () => {
		expect(() => checkVariantOptions(['talla', 'talla'], [])).toThrowError(DomainError);
	});
	it('rechaza opciones distintas a las de las demas variantes', () => {
		expect(() => checkVariantOptions(['talla'], [['talla', 'color']])).toThrow(/mismas opciones/);
		expect(() => checkVariantOptions([], [['talla']])).toThrow(/mismas opciones/);
		expect(() => checkVariantOptions(['talla'], [[]])).toThrow(/mismas opciones/);
	});
	it('marca el campo values', () => {
		try {
			checkVariantOptions(['a', 'a'], []);
		} catch (err) {
			expect(err.field).toBe('values');
		}
	});
});

describe('checkCategoryParent', () => {
	const root = { id: 'root', parent: '' };
	it('sin padre no hay nada que revisar', () => {
		expect(() => checkCategoryParent({ id: 'x', parentId: '' })).not.toThrow();
	});
	it('acepta una raiz como padre', () => {
		expect(() => checkCategoryParent({ parentId: 'root', parent: root })).not.toThrow();
	});
	it('rechaza ser su propio padre, padre inexistente o mas de un nivel', () => {
		expect(() => checkCategoryParent({ id: 'a', parentId: 'a', parent: root })).toThrow(
			/propio padre/
		);
		expect(() => checkCategoryParent({ parentId: 'zz', parent: null })).toThrow(/no existe/);
		expect(() =>
			checkCategoryParent({ parentId: 'child', parent: { id: 'child', parent: 'root' } })
		).toThrow(/un nivel/);
	});
	it('una categoria con hijos no puede pasar a ser hija', () => {
		expect(() =>
			checkCategoryParent({ id: 'a', parentId: 'root', parent: root, hasChildren: true })
		).toThrow(/subcategorías/);
	});
});
