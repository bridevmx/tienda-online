import { describe, expect, it } from 'vitest';
import { contactSchema, placeOrderSchema } from './schema.js';

const id = 'abcdefghij12345';
const base = {
	channel: 'web',
	method: 'transfer',
	lines: [{ variant: id, qty: 2 }],
	contact: { name: 'Ana López', email: 'ANA@Correo.com', phone: '55 1234 5678' },
	origin: 'https://tienda.test'
};
const check = (patch) => placeOrderSchema.safeParse({ ...base, ...patch });
const fields = (res) => res.error.issues.map((i) => i.path.join('.'));

describe('contactSchema', () => {
	it('normaliza correo y acepta telefono opcional', () => {
		expect(contactSchema.parse({ name: ' Ana ', email: ' ANA@x.com ' })).toEqual({
			name: 'Ana',
			email: 'ana@x.com',
			phone: ''
		});
	});
	it('rechaza datos invalidos', () => {
		expect(contactSchema.safeParse({ name: 'A', email: 'x@y.com' }).success).toBe(false);
		expect(contactSchema.safeParse({ name: 'Ana', email: 'no' }).success).toBe(false);
		expect(contactSchema.safeParse({ name: 'Ana', email: 'a@b.com', phone: 'abc' }).success).toBe(
			false
		);
		expect(
			contactSchema.safeParse({ name: 'Ana', email: 'a@b.com', phone: '+52 (55) 1234-5678' })
				.success
		).toBe(true);
	});
});

describe('placeOrderSchema: web', () => {
	it('acepta transferencia y tarjeta con contacto', () => {
		expect(check({}).success).toBe(true);
		expect(check({ method: 'card_clip' }).success).toBe(true);
	});
	it('rechaza efectivo y cobro inmediato en la web', () => {
		expect(fields(check({ method: 'cash' }))).toContain('method');
		expect(fields(check({ confirmNow: true }))).toContain('confirmNow');
	});
	it('exige contacto valido', () => {
		expect(fields(check({ contact: { name: '', email: 'x', phone: '' } }))).toEqual(
			expect.arrayContaining(['contact.name', 'contact.email'])
		);
	});
	it('valida lineas', () => {
		expect(check({ lines: [] }).success).toBe(false);
		expect(check({ lines: [{ variant: 'x', qty: 1 }] }).success).toBe(false);
		expect(check({ lines: [{ variant: id, qty: 0 }] }).success).toBe(false);
		expect(check({ lines: [{ variant: id, qty: 100 }] }).success).toBe(false);
		expect(
			check({
				lines: [
					{ variant: id, qty: 1 },
					{ variant: id, qty: 1 }
				]
			}).success
		).toBe(false);
	});
	it('metodo desconocido y origen invalido', () => {
		expect(check({ method: 'bitcoin' }).success).toBe(false);
		expect(check({ origin: 'no-es-url' }).success).toBe(false);
	});
});

describe('placeOrderSchema: tpv', () => {
	const pos = { channel: 'pos', createdBy: id, contact: {} };
	it('efectivo y transferencia al momento; contacto opcional', () => {
		expect(check({ ...pos, method: 'cash', confirmNow: true }).success).toBe(true);
		expect(check({ ...pos, method: 'transfer', confirmNow: true }).success).toBe(true);
	});
	it('contacto opcional pero, si hay correo, valido', () => {
		expect(
			check({ ...pos, method: 'cash', confirmNow: true, contact: { email: 'x' } }).success
		).toBe(false);
		expect(
			check({
				...pos,
				method: 'cash',
				confirmNow: true,
				contact: { email: 'a@b.com', name: 'Ana' }
			}).success
		).toBe(true);
	});
	it('exige cajero, cobra el efectivo al momento y la tarjeta solo por Clip', () => {
		expect(fields(check({ ...pos, createdBy: '', method: 'cash', confirmNow: true }))).toContain(
			'createdBy'
		);
		expect(check({ ...pos, method: 'cash', confirmNow: false }).success).toBe(false);
		expect(check({ ...pos, method: 'card_clip', confirmNow: true }).success).toBe(false);
		expect(check({ ...pos, method: 'card_clip' }).success).toBe(true);
	});
});
