import { describe, expect, it } from 'vitest';
import { processClipNotification, tokenMatches } from './clip-webhook.js';

describe('tokenMatches', () => {
	it('solo el token exacto', () => {
		expect(tokenMatches('secreto', 'secreto')).toBe(true);
		for (const bad of ['otro', 'secret', 'secretoo', '', undefined, null, 5])
			expect(tokenMatches(bad, 'secreto')).toBe(false);
		expect(tokenMatches('', '')).toBe(false); // sin token configurado nada pasa
	});
});

function setup({
	payment = { id: 'pay1', order: 'ord1' },
	remote = { status: 'paid' },
	clipError
} = {}) {
	const calls = [];
	const pb = {
		filter: (e, p) => `${e} ${JSON.stringify(p)}`,
		collection: () => ({
			getFirstListItem: async () => {
				if (!payment) throw Object.assign(new Error('nf'), { status: 404 });
				return payment;
			}
		})
	};
	const clip = {
		getCheckout: async (id) => {
			calls.push(['clip.get', id]);
			if (clipError) throw clipError;
			return { id, ...remote };
		}
	};
	const sales = {
		confirmPayment: async (...args) => (calls.push(['confirm', ...args]), { changed: true }),
		failPayment: async (id) => (calls.push(['fail', id]), { changed: true })
	};
	return { calls, args: { pb, clip, sales } };
}

describe('processClipNotification', () => {
	it('ignora avisos sin payment_request_id', async () => {
		const { args, calls } = setup();
		expect((await processClipNotification({ payload: {}, ...args })).status).toBe('ignored');
		expect((await processClipNotification({ payload: null, ...args })).status).toBe('ignored');
		expect(
			(await processClipNotification({ payload: { payment_request_id: 5 }, ...args })).status
		).toBe('ignored');
		expect(calls).toEqual([]);
	});
	it('un pago que no es nuestro: desconocido, sin consultar a Clip', async () => {
		const { args, calls } = setup({ payment: null });
		expect(
			(await processClipNotification({ payload: { payment_request_id: 'x' }, ...args })).status
		).toBe('unknown');
		expect(calls).toEqual([]);
	});
	it('confirma SOLO si Clip lo confirma, con el pago y el id del evento', async () => {
		const { args, calls } = setup({ remote: { status: 'paid' } });
		const out = await processClipNotification({
			payload: { payment_request_id: 'req1', id: 'evt1', resource_status: 'COMPLETED' },
			...args
		});
		expect(out).toEqual({ status: 'paid', changed: true });
		expect(calls).toEqual([
			['clip.get', 'req1'],
			['confirm', { id: 'ord1' }, { eventId: 'evt1', paymentId: 'pay1' }]
		]);
	});
	it('un aviso que dice COMPLETED pero Clip dice pendiente NO confirma (aviso falso)', async () => {
		const { args, calls } = setup({ remote: { status: 'pending' } });
		const out = await processClipNotification({
			payload: { payment_request_id: 'req1', resource_status: 'COMPLETED' },
			...args
		});
		expect(out.status).toBe('pending');
		expect(calls.some((c) => c[0] === 'confirm')).toBe(false);
	});
	it('usa un id de evento derivado si el aviso no trae id', async () => {
		const { args, calls } = setup();
		await processClipNotification({ payload: { payment_request_id: 'req1' }, ...args });
		expect(calls[1][2].eventId).toBe('req1:paid');
	});
	it('link cancelado o vencido: marca el intento fallido', async () => {
		const { args, calls } = setup({ remote: { status: 'failed' } });
		expect(
			await processClipNotification({ payload: { payment_request_id: 'req1' }, ...args })
		).toEqual({ status: 'failed', changed: true });
		expect(calls[1]).toEqual(['fail', 'pay1']);
	});
	it('si Clip no responde, propaga el error (el endpoint contesta 5xx y Clip reintenta)', async () => {
		const { args } = setup({ clipError: new Error('timeout') });
		await expect(
			processClipNotification({ payload: { payment_request_id: 'req1' }, ...args })
		).rejects.toThrow('timeout');
	});
});
