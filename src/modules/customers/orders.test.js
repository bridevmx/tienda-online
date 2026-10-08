import { describe, expect, it, vi } from 'vitest';
import { linkGuestOrders, toOrderCard } from './orders.js';

describe('toOrderCard', () => {
	const order = {
		code: 'W-20260101-ABCDE',
		created: 'x',
		status: 'pending',
		total: 5000,
		payment_method: 'transfer'
	};
	it('resume líneas y marca pendientes', () => {
		const items = ['a', 'b', 'c', 'd'].map((n) => ({ product_name: n, quantity: 2 }));
		const card = toOrderCard(order, items);
		expect(card.pending).toBe(true);
		expect(card.summary).toEqual(['2 × a', '2 × b', '2 × c']);
		expect(card.more).toBe(1);
		expect(card.href).toBe('/pedido/W-20260101-ABCDE');
	});
	it('no expone campos internos', () => {
		const card = toOrderCard({ ...order, access_token: 'secreto' }, []);
		expect(JSON.stringify(card)).not.toContain('secreto');
	});
});

describe('linkGuestOrders', () => {
	const pb = () => {
		const update = vi.fn();
		return {
			update,
			filter: (f, p) => `${f}|${JSON.stringify(p)}`,
			collection: () => ({ getFullList: async () => [{ id: 'o1' }, { id: 'o2' }], update })
		};
	};
	it('no hace nada si el correo no está verificado', async () => {
		const p = pb();
		expect(await linkGuestOrders(p, { id: 'c', email: 'a@b.c', verified: false })).toBe(0);
		expect(p.update).not.toHaveBeenCalled();
	});
	it('vincula los pedidos de invitado', async () => {
		const p = pb();
		expect(await linkGuestOrders(p, { id: 'c', email: 'A@b.c', verified: true })).toBe(2);
		expect(p.update).toHaveBeenCalledWith('o1', { customer: 'c' });
	});
});
