import { describe, expect, it } from 'vitest';
import { ClipError, createClipClient, normalizeClipStatus } from './clip.js';

describe('normalizeClipStatus', () => {
	it('tolera variantes de nombre', () => {
		for (const s of ['COMPLETED', 'CHECKOUT_COMPLETED', 'completed', 'PAID', 'APPROVED'])
			expect(normalizeClipStatus(s)).toBe('paid');
		for (const s of ['CANCELLED', 'CHECKOUT_CANCELLED', 'EXPIRED', 'FAILED', 'DECLINED'])
			expect(normalizeClipStatus(s)).toBe('failed');
		for (const s of ['CREATED', 'CHECKOUT_CREATED', 'PENDING', '', undefined, null])
			expect(normalizeClipStatus(s)).toBe('pending');
	});
});

function fakeFetch(handler) {
	const calls = [];
	const fn = async (url, init) => {
		calls.push({ url, init });
		const { status = 200, body } = handler(url, init, calls.length);
		return { ok: status >= 200 && status < 300, status, json: async () => body };
	};
	fn.calls = calls;
	return fn;
}
const cfg = (fetch) => ({
	baseUrl: 'https://api.test/',
	key: 'k',
	secret: 's',
	webhookToken: 't',
	fetch
});

describe('createClipClient', () => {
	it('isConfigured exige credenciales y token', () => {
		expect(createClipClient(cfg(fakeFetch(() => ({})))).isConfigured).toBe(true);
		expect(createClipClient({ ...cfg(fakeFetch(() => ({}))), webhookToken: '' }).isConfigured).toBe(
			false
		);
		expect(createClipClient({ ...cfg(fakeFetch(() => ({}))), key: '' }).isConfigured).toBe(false);
		expect(
			createClipClient({ baseUrl: '', key: 'k', secret: 's', webhookToken: 't' }).isConfigured
		).toBe(false);
	});

	it('createCheckout: Basic auth, pesos con 2 decimales, URLs de retorno y webhook', async () => {
		const fetch = fakeFetch(() => ({
			body: { payment_request_id: 'req-1', payment_request_url: 'https://pay/1', expires_at: 'x' }
		}));
		const out = await createClipClient(cfg(fetch)).createCheckout({
			amountCents: 120_711,
			description: 'Pedido W-1',
			successUrl: 'https://tienda/ok',
			errorUrl: 'https://tienda/error',
			webhookUrl: 'https://tienda/hook'
		});
		expect(out).toEqual({ id: 'req-1', url: 'https://pay/1', expiresAt: 'x' });
		const { url, init } = fetch.calls[0];
		expect(url).toBe('https://api.test/v2/checkout');
		expect(init.method).toBe('POST');
		expect(init.headers.authorization).toBe(`Basic ${Buffer.from('k:s').toString('base64')}`);
		expect(JSON.parse(init.body)).toEqual({
			amount: 1207.11,
			currency: 'MXN',
			purchase_description: 'Pedido W-1',
			redirection_url: {
				success: 'https://tienda/ok',
				error: 'https://tienda/error',
				default: 'https://tienda/ok'
			},
			webhook_url: 'https://tienda/hook'
		});
	});

	it('createCheckout falla con un error claro si Clip no devuelve el link o responde error', async () => {
		await expect(
			createClipClient(cfg(fakeFetch(() => ({ body: {} })))).createCheckout({ amountCents: 1 })
		).rejects.toBeInstanceOf(ClipError);
		await expect(
			createClipClient(cfg(fakeFetch(() => ({ status: 401, body: {} })))).createCheckout({
				amountCents: 1
			})
		).rejects.toMatchObject({ status: 401 });
		const boom = async () => {
			throw new Error('ECONNREFUSED');
		};
		await expect(createClipClient(cfg(boom)).createCheckout({ amountCents: 1 })).rejects.toThrow(
			/No pude conectar/
		);
	});

	it('createCheckout rechaza un link que no sea http(s) (se usa para redirigir)', async () => {
		const bad = fakeFetch(() => ({
			body: { payment_request_id: 'r', payment_request_url: 'javascript:alert(1)' }
		}));
		await expect(createClipClient(cfg(bad)).createCheckout({ amountCents: 1 })).rejects.toThrow(
			/no valido/
		);
	});

	it('getCheckout consulta y normaliza el estado', async () => {
		const fetch = fakeFetch(() => ({ body: { status: 'CHECKOUT_COMPLETED' } }));
		expect(await createClipClient(cfg(fetch)).getCheckout('req 1')).toEqual({
			id: 'req 1',
			status: 'paid',
			raw: 'CHECKOUT_COMPLETED'
		});
		expect(fetch.calls[0].url).toBe('https://api.test/v2/checkout/req%201');
		const other = fakeFetch(() => ({ body: { resource_status: 'CREATED' } }));
		expect((await createClipClient(cfg(other)).getCheckout('x')).status).toBe('pending');
	});
});
