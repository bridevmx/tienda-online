import { describe, expect, it } from 'vitest';
import { ORDER_STATUS, canTransition, orderStatusView } from './status.js';

describe('estados', () => {
	it('todos tienen texto y un color del tema', () => {
		for (const [status, view] of Object.entries(ORDER_STATUS)) {
			expect(view.label, status).toBeTruthy();
			expect(['primary', 'secondary', 'info', 'error']).toContain(view.badge);
		}
		expect(orderStatusView('raro')).toEqual({ label: 'raro', badge: 'info' });
	});
	it('transiciones permitidas', () => {
		expect(canTransition('pending', 'paid')).toBe(true);
		expect(canTransition('pending', 'cancelled')).toBe(true);
		expect(canTransition('paid', 'completed')).toBe(true);
		expect(canTransition('paid', 'refunded')).toBe(true);
		expect(canTransition('completed', 'refunded')).toBe(true);
	});
	it('transiciones prohibidas', () => {
		expect(canTransition('cancelled', 'paid')).toBe(false);
		expect(canTransition('paid', 'cancelled')).toBe(false);
		expect(canTransition('refunded', 'paid')).toBe(false);
		expect(canTransition('pending', 'completed')).toBe(false);
		expect(canTransition('nope', 'paid')).toBe(false);
	});
});
