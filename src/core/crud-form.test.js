import { describe, expect, it } from 'vitest';
import { toFormValues, toInput, toRepaintValues } from './crud-form.js';

const resource = {
	fields: [
		{ name: 'name', type: 'text' },
		{ name: 'price', type: 'money' },
		{ name: 'active', type: 'checkbox' },
		{ name: 'category', type: 'relation' },
		{ name: 'values', type: 'groups' },
		{ name: 'images', type: 'images' }
	]
};

describe('toInput', () => {
	it('un checkbox sin marcar es explicitamente falso', () => {
		expect(toInput(resource, {}).active).toBe('off');
		expect(toInput(resource, { active: 'on' }).active).toBe('on');
	});
	it('convierte pesos a centavos', () => {
		expect(toInput(resource, { price: '249.50' }).price).toBe('24950');
		expect(toInput(resource, { price: '$1,200.39' }).price).toBe('120039');
		expect(toInput(resource, { price: '' }).price).toBe('');
	});
	it('deja pasar texto no numerico para que el schema lo rechace', () => {
		expect(toInput(resource, { price: 'abc' }).price).toBe('abc');
	});
});

describe('toFormValues', () => {
	const record = {
		name: 'Gorra',
		price: 19900,
		active: false,
		category: 'abc',
		values: ['x', 'y'],
		images: ['a.png', 'b.png']
	};
	it('convierte un registro en valores de formulario', () => {
		const { values, files } = toFormValues(resource, record);
		expect(values).toMatchObject({
			name: 'Gorra',
			price: '199.00',
			active: false,
			category: 'abc'
		});
		expect(values.values).toEqual(['x', 'y']);
		expect(files.images).toEqual(['a.png', 'b.png']);
	});
	it('al crear, un checkbox arranca activo y el resto vacio', () => {
		const { values } = toFormValues(resource, {});
		expect(values.active).toBe(true);
		expect(values.price).toBe('');
		expect(values.values).toEqual([]);
	});
});

describe('toRepaintValues', () => {
	it('conserva lo escrito', () => {
		const values = toRepaintValues(resource, { name: 'x', price: 'abc', values: 'v1' });
		expect(values).toMatchObject({ name: 'x', price: 'abc', active: false });
		expect(values.values).toEqual(['v1']);
		expect('images' in values).toBe(false);
	});
});
