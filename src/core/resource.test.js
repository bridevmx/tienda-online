import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineModule } from './module.js';
import { buildNav, collectResources, defineResource, describeResource } from './resource.js';

const perms = (n) => ({
	read: `${n}:read`,
	create: `${n}:create`,
	update: `${n}:update`,
	delete: `${n}:delete`
});
const permDefs = (n) =>
	['read', 'create', 'update', 'delete'].map((a) => ({
		code: `${n}:${a}`,
		description: `${a} ${n}`
	}));

const base = (over = {}) => ({
	name: 'things',
	label: ['Cosa', 'Cosas'],
	permissions: perms('things'),
	schema: z.object({ name: z.string() }),
	columns: [{ key: 'name', label: 'Nombre' }],
	fields: [{ name: 'name', label: 'Nombre', type: 'text' }],
	...over
});

describe('defineResource', () => {
	it('aplica valores por defecto', () => {
		const r = defineResource(base());
		expect(r.collection).toBe('things');
		expect(r.titleField).toBe('name');
		expect(r.defaultSort).toBe('-created');
		expect(r.children).toEqual([]);
		expect(r.feminine).toBe(false);
	});
	it('rechaza definiciones mal formadas', () => {
		expect(() => defineResource(base({ name: 'Mal Nombre' }))).toThrow();
		expect(() => defineResource(base({ permissions: { read: 'x' } }))).toThrow();
		expect(() => defineResource(base({ schema: {} }))).toThrow();
		expect(() =>
			defineResource(base({ fields: [{ name: 'c', label: 'C', type: 'relation' }] }))
		).toThrow(/options/);
	});
});

describe('collectResources', () => {
	const mk = (name, extra = {}, permissions = permDefs(name)) =>
		defineModule({
			name,
			label: name.toUpperCase(),
			permissions,
			resources: [defineResource(base({ name, permissions: perms(name), ...extra }))]
		});

	it('reune recursos y anota su modulo', () => {
		const map = collectResources([mk('alpha'), mk('beta')]);
		expect([...map.keys()]).toEqual(['alpha', 'beta']);
		expect(map.get('alpha').module).toBe('alpha');
	});
	it('falla con nombres repetidos', () => {
		const a = mk('alpha');
		const dup = defineModule({
			name: 'other',
			label: 'O',
			permissions: permDefs('alpha'),
			resources: a.resources
		});
		expect(() => collectResources([a, dup])).toThrow(/duplicado/);
	});
	it('falla si un permiso no esta declarado en ningun modulo', () => {
		expect(() => collectResources([mk('alpha', {}, permDefs('alpha').slice(0, 3))])).toThrow(
			/no esta declarado/
		);
	});
	it('valida los hijos: que existan y que declaren el filtro de la clave foranea', () => {
		const parent = mk('parent', {
			children: [{ resource: 'kid', foreignKey: 'parent', label: 'Hijos' }]
		});
		expect(() => collectResources([parent])).toThrow(/no existe/);
		const kidNoFilter = mk('kid');
		expect(() => collectResources([parent, kidNoFilter])).toThrow(/debe declarar el filtro/);
		const kid = mk('kid', {
			fields: [
				{ name: 'name', label: 'N', type: 'text' },
				{
					name: 'parent',
					label: 'P',
					type: 'relation',
					options: { collection: 'parent', label: (r) => r.name }
				}
			],
			filters: [{ name: 'parent', type: 'relation', label: 'Padre' }]
		});
		expect(collectResources([parent, kid]).size).toBe(2);
	});
});

describe('describeResource', () => {
	it('no expone funciones ni schemas', () => {
		const r = defineResource(
			base({
				fields: [
					{
						name: 'c',
						label: 'C',
						type: 'relation',
						options: { collection: 'x', label: (r) => r.name }
					}
				]
			})
		);
		const view = describeResource(r);
		expect(JSON.stringify(view)).not.toContain('function');
		expect(view.fields[0].options).toBeUndefined();
		expect(view.schema).toBeUndefined();
	});
});

describe('buildNav', () => {
	const alpha = defineModule({
		name: 'alpha',
		label: 'Alfa',
		permissions: permDefs('alpha'),
		resources: [
			defineResource(base({ name: 'alpha', label: ['A', 'Alfas'], permissions: perms('alpha') }))
		],
		nav: [{ label: 'Extra', href: '/admin/extra', permission: 'alpha:update' }]
	});
	const hidden = defineModule({
		name: 'hid',
		label: 'Oculto',
		permissions: permDefs('hid'),
		resources: [defineResource(base({ name: 'hid', permissions: perms('hid'), hidden: true }))]
	});
	const resources = collectResources([alpha, hidden]);
	const href = (n) => `/admin/${n}`;

	it('muestra solo lo que el usuario puede leer', () => {
		expect(buildNav([alpha, hidden], resources, new Set(['alpha:read']), href)).toEqual([
			{ label: 'Alfa', items: [{ label: 'Alfas', href: '/admin/alpha' }] }
		]);
		expect(buildNav([alpha, hidden], resources, new Set(), href)).toEqual([]);
	});
	it('incluye entradas extra con su permiso y omite recursos ocultos', () => {
		const nav = buildNav(
			[alpha, hidden],
			resources,
			new Set(['alpha:read', 'alpha:update', 'hid:read']),
			href
		);
		expect(nav).toHaveLength(1);
		expect(nav[0].items.map((i) => i.label)).toEqual(['Alfas', 'Extra']);
	});
});
