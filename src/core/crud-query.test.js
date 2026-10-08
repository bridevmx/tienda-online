import { describe, expect, it } from 'vitest';
import { buildListFilter, parseListQuery } from './crud-query.js';

const id = 'abcdefghij12345';
const resource = {
	columns: [
		{ key: 'name', sortable: true },
		{ key: 'slug', sortable: false }
	],
	defaultSort: 'sort,name',
	search: ['name', 'slug'],
	filters: [
		{ name: 'category', type: 'relation' },
		{ name: 'active', type: 'bool' }
	]
};
const parse = (qs) => parseListQuery(resource, new URLSearchParams(qs));

describe('parseListQuery', () => {
	it('valores por defecto', () => {
		expect(parse('')).toEqual({ page: 1, q: '', sort: 'sort,name', filters: {}, perPage: 20 });
	});
	it('acepta orden permitido (y descendente) y rechaza el resto', () => {
		expect(parse('sort=name').sort).toBe('name');
		expect(parse('sort=-name').sort).toBe('-name');
		expect(parse('sort=created').sort).toBe('created');
		expect(parse('sort=slug').sort).toBe('sort,name');
		expect(parse('sort=password').sort).toBe('sort,name');
		expect(parse('sort=name;drop').sort).toBe('sort,name');
	});
	it('acota la pagina y recorta la busqueda', () => {
		expect(parse('page=-4').page).toBe(1);
		expect(parse('page=abc').page).toBe(1);
		expect(parse('page=99999999').page).toBe(10000);
		expect(parse(`q=${'x'.repeat(500)}`).q).toHaveLength(100);
	});
	it('valida los filtros', () => {
		expect(parse(`category=${id}&active=1`).filters).toEqual({ category: id, active: true });
		expect(parse('category=" || 1=1&active=2').filters).toEqual({});
		expect(parse('active=0').filters).toEqual({ active: false });
		expect(parse('otro=1').filters).toEqual({});
	});
});

describe('buildListFilter', () => {
	// pb.filter real: enlaza parametros; aqui un doble que los deja visibles
	const pb = { filter: (expr, params) => `${expr} ${JSON.stringify(params)}` };
	it('sin criterios no filtra', () => {
		expect(buildListFilter(pb, resource, { q: '', filters: {} })).toBe('');
	});
	it('enlaza la busqueda y los filtros como parametros', () => {
		const out = buildListFilter(pb, resource, {
			q: 'gorra',
			filters: { category: id, active: true }
		});
		expect(out).toContain(
			'(name ~ {:q} || slug ~ {:q}) && category = {:f_category} && active = {:f_active}'
		);
		expect(out).toContain('"q":"gorra"');
		expect(out).not.toContain('gorra ||'); // el texto del usuario nunca va en la expresion
	});
});
