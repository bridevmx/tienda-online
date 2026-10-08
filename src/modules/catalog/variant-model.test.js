import { describe, expect, it } from 'vitest';
import {
	buildOptionModel,
	defaultSelection,
	findVariant,
	paramsWith,
	selectionFrom,
	valueStates
} from './variant-model.js';

const T = (valueId, value, sort = 0) => ({
	optionId: 'talla',
	option: 'Talla',
	optionSort: 0,
	valueId,
	value,
	valueSort: sort
});
const C = (valueId, value, sort = 0) => ({
	optionId: 'color',
	option: 'Color',
	optionSort: 1,
	valueId,
	value,
	valueSort: sort
});
const S = T('s', 'S', 0),
	M = T('m', 'M', 1),
	L = T('l', 'L', 2);
const NEG = C('neg', 'Negro'),
	BLA = C('bla', 'Blanco', 1);

const variants = [
	{ id: 'v1', stock: 5, options: [S, NEG] },
	{ id: 'v2', stock: 0, options: [S, BLA] }, // agotada
	{ id: 'v3', stock: 3, options: [M, NEG] },
	{ id: 'v4', stock: 2, options: [L, BLA] }
];
const model = buildOptionModel(variants);

describe('buildOptionModel', () => {
	it('opciones y valores en orden, sin repetir', () => {
		expect(model.map((o) => o.name)).toEqual(['Talla', 'Color']);
		expect(model[0].values.map((v) => v.value)).toEqual(['S', 'M', 'L']);
		expect(model[1].values.map((v) => v.value)).toEqual(['Negro', 'Blanco']);
	});
	it('un producto simple no tiene opciones', () => {
		expect(buildOptionModel([{ id: 'x', stock: 1, options: [] }])).toEqual([]);
	});
});

describe('selectionFrom', () => {
	it('ignora ids ajenos y deja uno por opcion (gana el ultimo)', () => {
		const s = selectionFrom(['s', 'zzz', 'm', 'neg'], model);
		expect([...s]).toEqual([
			['talla', 'm'],
			['color', 'neg']
		]);
	});
});

describe('findVariant', () => {
	it('exige la seleccion completa', () => {
		expect(findVariant(variants, model, selectionFrom(['s', 'neg'], model)).id).toBe('v1');
		expect(findVariant(variants, model, selectionFrom(['s'], model))).toBeNull();
		expect(findVariant(variants, model, selectionFrom(['l', 'neg'], model))).toBeNull(); // no existe
	});
	it('producto simple: la unica variante', () => {
		const simple = [{ id: 'only', stock: 1, options: [] }];
		expect(findVariant(simple, [], new Map()).id).toBe('only');
	});
});

describe('valueStates', () => {
	it('con S elegida: Blanco existe pero esta agotado, Negro disponible', () => {
		const st = valueStates(variants, model, selectionFrom(['s'], model));
		expect(st.get('neg')).toEqual({ selected: false, status: 'available' });
		expect(st.get('bla').status).toBe('soldout');
		expect(st.get('s').selected).toBe(true);
	});
	it('marca como imposible lo que no existe en combinacion', () => {
		const st = valueStates(variants, model, selectionFrom(['l'], model)); // L solo existe en Blanco
		expect(st.get('neg').status).toBe('impossible');
		expect(st.get('bla').status).toBe('available');
	});
	it('sin seleccion, todo lo que tenga alguna variante con stock esta disponible', () => {
		const st = valueStates(variants, model, new Map());
		expect([...st.values()].every((s) => s.status === 'available')).toBe(true);
	});
});

describe('defaultSelection y paramsWith', () => {
	it('arranca en la primera variante con stock', () => {
		expect([...defaultSelection(variants)]).toEqual([
			['talla', 's'],
			['color', 'neg']
		]);
		const allOut = variants.map((v) => ({ ...v, stock: 0 }));
		expect([...defaultSelection(allOut)]).toEqual([
			['talla', 's'],
			['color', 'neg']
		]);
		expect(defaultSelection([]).size).toBe(0);
	});
	it('paramsWith cambia solo la opcion tocada y respeta el orden', () => {
		const sel = selectionFrom(['s', 'neg'], model);
		expect(paramsWith(model, sel, 'color', 'bla')).toEqual(['s', 'bla']);
		expect(paramsWith(model, new Map(), 'talla', 'm')).toEqual(['m']);
	});
});
