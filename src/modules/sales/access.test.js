import { describe, expect, it } from 'vitest';
import { canViewOrder } from './access.js';

const order = { customer: 'cust1', access_token: 'TOKEN-123' };

describe('canViewOrder', () => {
	it('con el token del pedido', () => {
		expect(canViewOrder({ order, token: 'TOKEN-123' })).toBe(true);
		expect(canViewOrder({ order, token: 'otro' })).toBe(false);
		expect(canViewOrder({ order, token: '' })).toBe(false);
		expect(canViewOrder({ order, token: null })).toBe(false);
	});
	it('el cliente dueno, sin token', () => {
		expect(canViewOrder({ order, customerId: 'cust1' })).toBe(true);
		expect(canViewOrder({ order, customerId: 'cust2' })).toBe(false);
		expect(canViewOrder({ order: { ...order, customer: '' }, customerId: '' })).toBe(false);
	});
	it('el personal con orders:read', () => {
		expect(canViewOrder({ order, permissions: new Set(['orders:read']) })).toBe(true);
		expect(canViewOrder({ order, permissions: new Set(['pos:use']) })).toBe(false);
	});
	it('un pedido sin token no se abre con un token vacio', () => {
		expect(canViewOrder({ order: { customer: '', access_token: '' }, token: '' })).toBe(false);
	});
});
