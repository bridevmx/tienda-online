import { describe, expect, it } from 'vitest';
import { categorySchema, optionValueSchema, productSchema, variantSchema } from './schema.js';

const id = 'abcdefghij12345';

describe('categorySchema', () => {
	it('genera el slug desde el nombre y aplica valores por defecto', () => {
		expect(categorySchema.parse({ name: 'Camisetas básicas' })).toEqual({
			name: 'Camisetas básicas',
			slug: 'camisetas-basicas',
			parent: '',
			sort: 0,
			active: true
		});
	});
	it('respeta un slug explicito y lo valida', () => {
		expect(categorySchema.parse({ name: 'Ropa', slug: 'prendas' }).slug).toBe('prendas');
		expect(categorySchema.safeParse({ name: 'Ropa', slug: 'Mal Slug' }).success).toBe(false);
	});
	it('interpreta un formulario HTML (checkbox y numeros como texto)', () => {
		const fd = { name: 'Ropa', sort: '3' }; // checkbox sin marcar no se envia
		const data = categorySchema.parse(fd);
		expect(data.sort).toBe(3);
		expect(data.active).toBe(true); // por defecto activa
		expect(categorySchema.parse({ ...fd, active: 'on' }).active).toBe(true);
	});
	it('exige nombre', () => {
		expect(categorySchema.safeParse({ name: '  ' }).success).toBe(false);
	});
});

describe('productSchema', () => {
	it('exige categoria valida', () => {
		expect(productSchema.safeParse({ name: 'Gorra' }).success).toBe(false);
		expect(productSchema.parse({ name: 'Gorra', category: id }).slug).toBe('gorra');
	});
});

describe('optionValueSchema', () => {
	it('valida opcion y valor', () => {
		expect(optionValueSchema.parse({ option: id, value: ' M ' })).toMatchObject({
			value: 'M',
			sort: 0
		});
		expect(optionValueSchema.safeParse({ option: 'x', value: 'M' }).success).toBe(false);
	});
});

describe('variantSchema', () => {
	const base = { product: id, sku: ' cam-neg-s ', price: '24900', stock: '0' };
	it('normaliza el SKU y convierte numeros', () => {
		expect(variantSchema.parse(base)).toMatchObject({
			sku: 'CAM-NEG-S',
			price: 24900,
			stock: 0,
			values: [],
			active: true
		});
	});
	it('rechaza precios con decimales, negativos y SKU invalidos', () => {
		expect(variantSchema.safeParse({ ...base, price: '249.50' }).success).toBe(false);
		expect(variantSchema.safeParse({ ...base, stock: '-1' }).success).toBe(false);
		expect(variantSchema.safeParse({ ...base, sku: 'sku con espacios' }).success).toBe(false);
	});
	it('acepta uno o varios valores de opcion', () => {
		expect(variantSchema.parse({ ...base, values: id }).values).toEqual([id]);
		expect(variantSchema.parse({ ...base, values: [id, 'zyxwvutsrq54321'] }).values).toHaveLength(
			2
		);
	});
});
