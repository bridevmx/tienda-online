import { describe, expect, it } from 'vitest';
import { ClipError, createClipClient, isClipId, normalizeClipStatus } from './clip.js';

const UUID = '3f2a9c1e-5b7d-4e8a-9c0b-1a2b3c4d5e6f';

describe('normalizeClipStatus (estados oficiales)', () => {
	it('mapea exactamente los cinco estados', () => {
		expect(normalizeClipStatus('CHECKOUT_COMPLETED')).toBe('paid');
		expect(normalizeClipStatus('CHECKOUT_CANCELLED')).toBe('failed');
		expect(normalizeClipStatus('CHECKOUT_EXPIRED')).toBe('failed');
		expect(normalizeClipStatus('CHECKOUT_CREATED')).toBe('pending');
		expect(normalizeClipStatus('CHECKOUT_PENDING')).toBe('pending');
	});
	it('un estado desconocido o ambiguo NUNCA cuenta como pagado', () => {
		for (const s of [
			'COMPLETED',
			'PAID',
			'APPROVED',
			'SUCCESS',
			'completed ',
			'',
			undefined,
			null,
			5
		])
			expect(normalizeClipStatus(s)).toBe('pending');
	});
});

describe('isClipId', () => {
	it('solo UUID', () => {
		expect(isClipId(UUID)).toBe(true);
		for (const bad of ['req-1', '', null, undefined, 5, `${UUID}x`, "' OR 1=1"])
			expect(isClipId(bad)).toBe(false);
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
const cfg = (fetch, extra = {}) => ({
	baseUrl: 'https://api.test/',
	key: 'k',
	secret: 's',
	webhookToken: 'token-del-webhook-largo-0123456789',
	fetch,
	...extra
});
const link = {
	payment_request_id: UUID,
	payment_request_url: 'https://pay.test/1',
	status: 'CHECKOUT_CREATED'
};
const checkoutArgs = {
	amountCents: 120_711,
	description: 'Pedido W-1',
	reference: 'TDA-abc123def456ghi-AbCdEfGh',
	successUrl: 'https://tienda/ok',
	errorUrl: 'https://tienda/error',
	defaultUrl: 'https://tienda/',
	webhookUrl: 'https://tienda/hook'
};

describe('createClipClient', () => {
	it('isConfigured exige credenciales (token o key+secret) y token de webhook', () => {
		const f = fakeFetch(() => ({}));
		expect(createClipClient(cfg(f)).isConfigured).toBe(true);
		expect(createClipClient(cfg(f, { key: '', secret: '', token: 'Basic abc' })).isConfigured).toBe(
			true
		);
		expect(createClipClient(cfg(f, { webhookToken: '' })).isConfigured).toBe(false);
		expect(createClipClient(cfg(f, { key: '' })).isConfigured).toBe(false);
		expect(
			createClipClient({ baseUrl: '', key: 'k', secret: 's', webhookToken: 't' }).isConfigured
		).toBe(false);
	});

	it('autenticacion: Basic con key:secret, o el token tal cual', async () => {
		const f = fakeFetch(() => ({ body: link }));
		await createClipClient(cfg(f)).createCheckout(checkoutArgs);
		expect(f.calls[0].init.headers.authorization).toBe(
			`Basic ${Buffer.from('k:s').toString('base64')}`
		);
		const f2 = fakeFetch(() => ({ body: link }));
		await createClipClient(cfg(f2, { token: 'Bearer xyz' })).createCheckout(checkoutArgs);
		expect(f2.calls[0].init.headers.authorization).toBe('Bearer xyz');
	});

	it('createCheckout: cuerpo oficial completo', async () => {
		const f = fakeFetch(() => ({ body: { ...link, expires_at: 'x' } }));
		const out = await createClipClient(cfg(f)).createCheckout(checkoutArgs);
		expect(out).toEqual({ id: UUID, url: 'https://pay.test/1', expiresAt: 'x' });
		const { url, init } = f.calls[0];
		expect(url).toBe('https://api.test/v2/checkout');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({
			amount: 1207.11,
			currency: 'MXN',
			purchase_description: 'Pedido W-1',
			redirection_url: {
				success: 'https://tienda/ok',
				error: 'https://tienda/error',
				default: 'https://tienda/'
			},
			metadata: { external_reference: 'TDA-abc123def456ghi-AbCdEfGh' },
			webhook_url: 'https://tienda/hook',
			custom_payment_options: { payment_method_types: ['credit', 'debit'] }
		});
	});

	it('recorta la descripcion a 250 y usa success como default si no se da', async () => {
		const f = fakeFetch(() => ({ body: link }));
		await createClipClient(cfg(f)).createCheckout({
			...checkoutArgs,
			description: 'x'.repeat(400),
			defaultUrl: undefined
		});
		const body = JSON.parse(f.calls[0].init.body);
		expect(body.purchase_description).toHaveLength(250);
		expect(body.redirection_url.default).toBe('https://tienda/ok');
	});

	it('rechaza ids que no son UUID y links que no son https', async () => {
		const ask = (body, base) =>
			createClipClient(
				cfg(
					fakeFetch(() => ({ body })),
					{ baseUrl: base ?? 'https://api.test' }
				)
			).createCheckout(checkoutArgs);
		await expect(ask({ ...link, payment_request_id: 'req-1' })).rejects.toThrow(/id de solicitud/);
		await expect(ask({ ...link, payment_request_url: 'http://pay/1' })).rejects.toThrow(/link/);
		await expect(ask({ ...link, payment_request_url: 'javascript:alert(1)' })).rejects.toThrow(
			/link/
		);
		await expect(ask({ payment_request_id: UUID })).rejects.toThrow(/link/);
		// contra un servidor de pruebas http se permite http
		await expect(
			ask({ ...link, payment_request_url: 'http://pay/1' }, 'http://127.0.0.1:1')
		).resolves.toBeTruthy();
	});

	it('getCheckout: estado, monto en centavos, moneda, referencia y recibo', async () => {
		const f = fakeFetch(() => ({
			body: {
				payment_request_id: UUID,
				status: 'CHECKOUT_COMPLETED',
				amount: 1207.11,
				currency: 'MXN',
				metadata: { external_reference: 'TDA-x' },
				receipt_no: 'R-77'
			}
		}));
		const out = await createClipClient(cfg(f)).getCheckout(UUID);
		expect(f.calls[0].url).toBe(`https://api.test/v2/checkout/${UUID}`);
		expect(out).toEqual({
			id: UUID,
			status: 'paid',
			rawStatus: 'CHECKOUT_COMPLETED',
			amountCents: 120_711,
			currency: 'MXN',
			reference: 'TDA-x',
			receiptNo: 'R-77'
		});
	});

	it('getCheckout: sin recibo ni monto cuando Clip no los manda; ids invalidos no salen a la red', async () => {
		const f = fakeFetch(() => ({ body: { status: 'CHECKOUT_PENDING' } }));
		const client = createClipClient(cfg(f));
		const out = await client.getCheckout(UUID);
		expect(out).toMatchObject({
			status: 'pending',
			amountCents: null,
			receiptNo: null,
			reference: null
		});
		await expect(client.getCheckout('../../admin')).rejects.toThrow(ClipError);
		expect(f.calls).toHaveLength(1);
	});

	it('errores: lee message o code_message y explica 401, 403 y 412', async () => {
		const run = (status, body) =>
			createClipClient(cfg(fakeFetch(() => ({ status, body })))).getCheckout(UUID);
		await expect(run(401, { message: 'Invalid token' })).rejects.toThrow(
			/401.*credenciales.*Invalid token/
		);
		await expect(run(403, {})).rejects.toThrow(/403.*Mexico/);
		await expect(run(412, { code_message: 'rate' })).rejects.toThrow(/412.*limite.*rate/);
		const err = await run(500, { code: '101' }).catch((e) => e);
		expect(err).toBeInstanceOf(ClipError);
		expect(err.status).toBe(500);
		expect(err.code).toBe('101');
	});

	it('error de red: ClipError', async () => {
		const failing = async () => {
			throw new Error('ECONNREFUSED');
		};
		await expect(createClipClient(cfg(failing)).getCheckout(UUID)).rejects.toThrow(
			/No pude conectar/
		);
	});

	it('firma y reconoce referencias con el token del webhook', () => {
		const client = createClipClient(cfg(fakeFetch(() => ({}))));
		const ref = client.makeReference('abc123def456ghi');
		expect(ref.length).toBeLessThanOrEqual(36);
		expect(client.parseReference(ref)).toBe('abc123def456ghi');
		expect(client.parseReference('TDA-abc123def456ghi-AAAAAAAA')).toBeNull();
	});
});
