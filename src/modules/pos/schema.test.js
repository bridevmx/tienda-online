import { describe, expect, it } from 'vitest';
import { chargeSchema } from './schema.js';

const id = 'abcde1234567890';
const ok = (o) => chargeSchema.safeParse(o);

describe('chargeSchema', () => {
	it('acepta el ticket en JSON', () => {
		const r = ok({
			lines: JSON.stringify([{ variant: id, qty: 2 }]),
			method: 'cash',
			received: '50000'
		});
		expect(r.success && r.data.received).toBe(50000);
	});
	it('rechaza ticket vacío, JSON roto y método desconocido', () => {
		expect(ok({ lines: '[]', method: 'cash' }).success).toBe(false);
		expect(ok({ lines: '{no', method: 'cash' }).success).toBe(false);
		expect(
			ok({ lines: JSON.stringify([{ variant: id, qty: 1 }]), method: 'bitcoin' }).success
		).toBe(false);
	});
	it('limita cantidades', () => {
		expect(ok({ lines: JSON.stringify([{ variant: id, qty: 0 }]), method: 'cash' }).success).toBe(
			false
		);
		expect(ok({ lines: JSON.stringify([{ variant: id, qty: 100 }]), method: 'cash' }).success).toBe(
			false
		);
	});
});
