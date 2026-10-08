import { describe, expect, it, vi } from 'vitest';
import { reconcileClipPayments } from './reconcile.js';

const LINK_A = '3f2a9c1e-5b7d-4e8a-9c0b-1a2b3c4d5e6f';
const LINK_B = '4a2b9c1e-5b7d-4e8a-9c0b-1a2b3c4d5e70';

function deps(pending, statuses) {
	const queries = [];
	const pb = {
		filter: (expr, params) => ({ expr, params }),
		collection: (name) => ({
			getList: async (page, limit, opts) => (
				queries.push({ name, limit, opts }),
				{ items: pending }
			),
			getFirstListItem: async (f) => ({
				id: f.params.ref.slice(0, 15),
				order: 'o',
				status: 'pending',
				amount: 100,
				reference: 'ref'
			})
		})
	};
	const clip = {
		parseReference: () => 'ignored',
		getCheckout: async (id) => {
			const s = statuses[id];
			if (s instanceof Error) throw s;
			return { id, status: s, amountCents: 100, currency: 'MXN', reference: 'ref', receiptNo: 'R' };
		}
	};
	const sales = {
		confirmPayment: vi.fn(async () => ({ changed: true })),
		failPayment: vi.fn(async () => ({ changed: true })),
		notePayment: vi.fn()
	};
	return { pb, clip, sales, queries };
}

describe('reconcileClipPayments', () => {
	it('consulta solo pagos con tarjeta pendientes de los ultimos 3 dias', async () => {
		const d = deps([], {});
		await reconcileClipPayments({ ...d, now: () => new Date('2026-10-10T12:00:00Z') });
		const { expr, params } = d.queries[0].opts.filter;
		expect(expr).toContain('method = "card_clip"');
		expect(expr).toContain('status = "pending"');
		expect(expr).toContain('provider_ref != ""');
		expect(expr).toContain('provider_note = ""'); // anomalias ya senaladas: revision manual
		expect(params.since).toBe('2026-10-07 12:00:00.000Z');
	});

	it('cuenta resultados y un error no detiene a los demas', async () => {
		const d = deps([{ provider_ref: LINK_A }, { provider_ref: LINK_B }], {
			[LINK_A]: new Error('timeout'),
			[LINK_B]: 'pending'
		});
		d.clip.parseReference = () => LINK_B.slice(0, 15);
		const out = await reconcileClipPayments(d);
		expect(out.checked).toBe(2);
		expect(out.pending).toBe(1);
		expect(out.errors).toEqual([{ payment: undefined, error: 'timeout' }]);
	});
});
