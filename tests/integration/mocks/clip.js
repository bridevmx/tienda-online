import http from 'node:http';

/**
 * Doble de la API de Clip: crea links de pago (POST /v2/checkout) y consulta su estado
 * (GET /v2/checkout/:id), con autenticacion Basic como la real. Los tests lo controlan por HTTP
 * (corre en otro proceso que los tests): /__mock/complete/:id, /__mock/cancel/:id, /__mock/fail-next,
 * /__mock/requests y /__mock/reset.
 */
export const CLIP_KEY = 'test-key';
export const CLIP_SECRET = 'test-secret';
export const CLIP_WEBHOOK_TOKEN = 'webhook-secret';

export async function startClipMock() {
	const checkouts = new Map();
	const requests = [];
	let failNext = false;
	let sequence = 0;
	let baseUrl = '';

	const send = (res, status, body) => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body));
	};
	const readJson = (req) =>
		new Promise((resolve) => {
			let data = '';
			req.on('data', (c) => (data += c));
			req.on('end', () => {
				try {
					resolve(data ? JSON.parse(data) : {});
				} catch {
					resolve(null);
				}
			});
		});

	const server = http.createServer(async (req, res) => {
		const url = new URL(req.url, 'http://mock');

		// ---- control para los tests
		if (url.pathname.startsWith('/__mock/')) {
			const [, , action, id] = url.pathname.split('/');
			if (action === 'complete' || action === 'cancel') {
				const c = checkouts.get(id);
				if (!c) return send(res, 404, { error: 'unknown' });
				c.status = action === 'complete' ? 'CHECKOUT_COMPLETED' : 'CHECKOUT_CANCELLED';
				return send(res, 200, c);
			}
			if (action === 'fail-next') {
				failNext = true;
				return send(res, 200, { ok: true });
			}
			if (action === 'requests') return send(res, 200, requests);
			if (action === 'reset') {
				checkouts.clear();
				requests.length = 0;
				failNext = false;
				return send(res, 200, { ok: true });
			}
			return send(res, 404, {});
		}

		// ---- API de Clip
		requests.push({
			method: req.method,
			path: url.pathname,
			auth: req.headers.authorization ?? null
		});
		const expected = `Basic ${Buffer.from(`${CLIP_KEY}:${CLIP_SECRET}`).toString('base64')}`;
		if (req.headers.authorization !== expected) return send(res, 401, { error: 'unauthorized' });

		if (req.method === 'POST' && url.pathname === '/v2/checkout') {
			if (failNext) {
				failNext = false;
				return send(res, 500, { error: 'boom' });
			}
			const body = await readJson(req);
			const valid =
				body &&
				typeof body.amount === 'number' &&
				body.amount > 0 &&
				body.currency === 'MXN' &&
				typeof body.purchase_description === 'string' &&
				body.redirection_url?.success &&
				body.webhook_url;
			if (!valid) return send(res, 400, { error: 'invalid body', body });
			const id = `req-${++sequence}`;
			const checkout = {
				payment_request_id: id,
				status: 'CHECKOUT_CREATED',
				amount: body.amount,
				request: body
			};
			checkouts.set(id, checkout);
			requests[requests.length - 1].body = body;
			return send(res, 200, {
				payment_request_id: id,
				payment_request_url: `${baseUrl}/pay/${id}`,
				status: 'CHECKOUT_CREATED',
				expires_at: new Date(Date.now() + 86_400_000).toISOString(),
				qr_image_url: `${baseUrl}/qr/${id}.png`,
				api_version: '2'
			});
		}
		const match = url.pathname.match(/^\/v2\/checkout\/([^/]+)$/);
		if (req.method === 'GET' && match) {
			const c = checkouts.get(decodeURIComponent(match[1]));
			return c
				? send(res, 200, {
						payment_request_id: c.payment_request_id,
						status: c.status,
						amount: c.amount
					})
				: send(res, 404, { error: 'not found' });
		}
		return send(res, 404, { error: 'not implemented' });
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	baseUrl = `http://127.0.0.1:${server.address().port}`;

	return { url: baseUrl, stop: () => new Promise((resolve) => server.close(resolve)) };
}
