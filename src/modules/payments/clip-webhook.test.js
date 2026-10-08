import { describe, expect, it } from 'vitest';
import { createClipClient } from './clip.js';
import { processClipNotification, tokenMatches, verifyClipPayment } from './clip-webhook.js';

const LINK = '3f2a9c1e-5b7d-4e8a-9c0b-1a2b3c4d5e6f';
const PAY_ID = 'abc123def456ghi';
const signer = createClipClient({
	baseUrl: 'https://x',
	key: 'k',
	secret: 's',
	webhookToken: 'token-largo-de-prueba-0123456789'
});
const REF = signer.makeReference(PAY_ID);

describe('tokenMatches', () => {
	it('solo el token exacto', () => {
		expect(tokenMatches('secreto', 'secreto')).toBe(true);
		for (const bad of ['otro', 'secret', 'secretoo', '', undefined, null, 5])
			expect(tokenMatches(bad, 'secreto')).toBe(false);
		expect(tokenMatches('', '')).toBe(false);
	});
});

function setup({
	payment = { id: PAY_ID, order: 'ord1', status: 'pending', amount: 120_711, reference: REF },
	remote = {},
	receiptReused = false,
	clipError
} = {}) {
	const calls = [];
	const logs = [];
	const pb = {
		filter: (e, p) => `${e} ${JSON.stringify(p)}`,
		collection: () => ({
			getList: async () => ({ totalItems: receiptReused ? 1 : 0 }),
			getFirstListItem: async () => {
				if (!payment) throw Object.assign(new Error('nf'), { status: 404 });
				return payment;
			}
		})
	};
	const completed = {
		status: 'paid',
		rawStatus: 'CHECKOUT_COMPLETED',
		amountCents: 120_711,
		currency: 'MXN',
		reference: REF,
		receiptNo: 'R-1'
	};
	const clip = {
		parseReference: signer.parseReference,
		getCheckout: async (id) => {
			calls.push(['clip.get', id]);
			if (clipError) throw clipError;
			return { id, ...completed, ...remote };
		}
	};
	const sales = {
		confirmPayment: async (...args) => (calls.push(['confirm', ...args]), { changed: true }),
		failPayment: async (id) => (calls.push(['fail', id]), { changed: true }),
		notePayment: async (id, note) => (calls.push(['note', id, note]), undefined)
	};
	const log = { error: (m) => logs.push(m) };
	return { calls, logs, args: { pb, clip, sales, log } };
}

describe('verifyClipPayment', () => {
	it('un id que no es UUID ni se busca', async () => {
		const { args, calls } = setup();
		for (const linkId of [undefined, null, 5, 'req-1', '', `${LINK}x`])
			expect((await verifyClipPayment({ linkId, ...args })).status).toBe('unknown');
		expect(calls).toEqual([]);
	});

	it('un UUID que no es nuestro: desconocido, sin consultar a Clip', async () => {
		const { args, calls } = setup({ payment: null });
		expect((await verifyClipPayment({ linkId: LINK, ...args })).status).toBe('unknown');
		expect(calls).toEqual([]);
	});

	it('COMPLETADO con todo coincidente: confirma con el pago, la solicitud y el recibo', async () => {
		const { args, calls } = setup();
		const out = await verifyClipPayment({ linkId: LINK, ...args });
		expect(out).toEqual({ status: 'paid', changed: true });
		expect(calls).toEqual([
			['clip.get', LINK],
			['confirm', { id: 'ord1' }, { eventId: LINK, paymentId: PAY_ID, receiptNo: 'R-1' }]
		]);
	});

	it('pendiente (creado / en espera) no confirma ni falla', async () => {
		const { args, calls } = setup({
			remote: { status: 'pending', rawStatus: 'CHECKOUT_PENDING', receiptNo: null }
		});
		expect((await verifyClipPayment({ linkId: LINK, ...args })).status).toBe('pending');
		expect(calls.map((c) => c[0])).toEqual(['clip.get']);
	});

	it('cancelado o vencido en Clip: el intento falla', async () => {
		const { args, calls } = setup({ remote: { status: 'failed', rawStatus: 'CHECKOUT_EXPIRED' } });
		expect((await verifyClipPayment({ linkId: LINK, ...args })).status).toBe('failed');
		expect(calls).toContainEqual(['fail', PAY_ID]);
	});

	it('COMPLETADO sin recibo todavia: sigue pendiente (se reintenta)', async () => {
		const { args, calls } = setup({ remote: { receiptNo: null } });
		expect((await verifyClipPayment({ linkId: LINK, ...args })).status).toBe('pending');
		expect(calls.map((c) => c[0])).toEqual(['clip.get']);
	});

	it.each([
		['monto distinto', { amountCents: 100 }, /monto distinto/],
		['moneda distinta', { currency: 'USD' }, /moneda distinta/],
		['moneda ausente', { currency: null }, /moneda distinta/],
		['monto ausente', { amountCents: null }, /monto distinto/],
		['referencia ajena', { reference: 'TDA-zzz123def456ghi-AAAAAAAA' }, /referencia distinta/],
		['sin referencia', { reference: null }, /referencia distinta/]
	])('anomalia (%s): NO confirma, NO cancela, deja nota y log', async (_name, remote, pattern) => {
		const { args, calls, logs } = setup({ remote });
		const out = await verifyClipPayment({ linkId: LINK, ...args });
		expect(out.status).toBe('mismatch');
		const kinds = calls.map((c) => c[0]);
		expect(kinds).toContain('note');
		expect(kinds).not.toContain('confirm');
		expect(kinds).not.toContain('fail');
		expect(calls.find((c) => c[0] === 'note')[2]).toMatch(pattern);
		expect(logs[0]).toMatch(/Revisar a mano/);
	});

	it('una referencia con firma valida pero de OTRO pago tampoco sirve', async () => {
		const other = signer.makeReference('zzz123def456ghi');
		const { args, calls } = setup({ remote: { reference: other } });
		expect((await verifyClipPayment({ linkId: LINK, ...args })).status).toBe('mismatch');
		expect(calls.map((c) => c[0])).not.toContain('confirm');
	});

	it('un recibo que ya acredito otro pago: anomalia, no se confirma', async () => {
		const { args, calls, logs } = setup({ receiptReused: true });
		expect((await verifyClipPayment({ linkId: LINK, ...args })).status).toBe('mismatch');
		expect(calls.map((c) => c[0])).toEqual(['clip.get', 'note']);
		expect(calls[1][2]).toMatch(/ya acredito otro pago/);
		expect(logs[0]).toMatch(/Revisar a mano/);
	});

	it('un pago ya confirmado o devuelto no vuelve a preguntar a Clip', async () => {
		for (const status of ['confirmed', 'refunded']) {
			const { args, calls } = setup({
				payment: { id: PAY_ID, order: 'o', status, amount: 1, reference: REF }
			});
			expect(await verifyClipPayment({ linkId: LINK, ...args })).toEqual({
				status: 'paid',
				changed: false
			});
			expect(calls).toEqual([]);
		}
	});

	it('un pago fallido SI se vuelve a consultar (pago tardio)', async () => {
		const { args, calls } = setup({
			payment: { id: PAY_ID, order: 'o', status: 'failed', amount: 120_711, reference: REF }
		});
		expect((await verifyClipPayment({ linkId: LINK, ...args })).status).toBe('paid');
		expect(calls.map((c) => c[0])).toEqual(['clip.get', 'confirm']);
	});

	it('si Clip no responde, el error se propaga (el reconciliador reintenta)', async () => {
		const { args } = setup({ clipError: new Error('timeout') });
		await expect(verifyClipPayment({ linkId: LINK, ...args })).rejects.toThrow('timeout');
	});
});

describe('processClipNotification', () => {
	it('solo usa el `id` del aviso oficial', async () => {
		const { args, calls } = setup();
		await processClipNotification({
			payload: {
				id: LINK,
				origin: 'checkout-api',
				event_type: 'UPDATE',
				status: 'CHECKOUT_COMPLETED',
				amount: 1
			},
			...args
		});
		expect(calls[0]).toEqual(['clip.get', LINK]);
	});
	it('ignora payloads sin id, con id ajeno o con la forma vieja', async () => {
		const { args, calls } = setup();
		for (const payload of [
			null,
			undefined,
			{},
			{ id: 5 },
			{ payment_request_id: LINK },
			{ id: 'req-9' }
		])
			expect((await processClipNotification({ payload, ...args })).status).toBe('unknown');
		expect(calls).toEqual([]);
	});
});
