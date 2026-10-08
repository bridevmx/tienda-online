import { afterAll, beforeAll, describe, it } from 'vitest';
import {
	cartWith,
	cfg,
	client,
	clipEvent,
	count,
	clipMock,
	enabled,
	first,
	ok,
	raw,
	runScript,
	saveSettings,
	sendClipWebhook,
	staff,
	su as suPb,
	waitFor
} from './support.js';
import { CLIP_KEY, CLIP_SECRET } from './mocks/clip.js';

const contact = { name: 'Ana López', email: 'ana@correo.test', phone: '55 1234 5678' };
const clipEnv = () => ({
	CLIP_API_URL: cfg.clipUrl,
	CLIP_API_KEY: CLIP_KEY,
	CLIP_API_SECRET: CLIP_SECRET,
	CLIP_WEBHOOK_TOKEN: cfg.clipWebhookToken
});

/** Pedido con tarjeta: devuelve { id (solicitud de Clip), payment, order, browser }. */
async function cardOrder(sku = 'TAZ-CER') {
	const browser = await cartWith([[sku, 1]]);
	const res = await browser.post('/checkout', { ...contact, method: 'card_clip' });
	const id = String(res.location).match(/\/pay\/([0-9a-f-]{36})$/)?.[1];
	if (!id) throw new Error(`Checkout sin link de Clip: ${res.status} ${res.location}`);
	const payment = await first('payments', `provider_ref="${id}"`);
	const order = await (await suPb()).collection('orders').getOne(payment.order);
	return { id, payment, order, browser };
}
const paymentOf = async (id) => first('payments', `provider_ref="${id}"`);
const orderOf = async (order) => (await suPb()).collection('orders').getOne(order.id);
const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!enabled)('Clip: verificacion de pagos', () => {
	let boss;
	beforeAll(async () => {
		boss = await staff('boss');
		await saveSettings(boss, { 'clip.apply_fee': 'on' });
		await clipMock.reset();
	});
	afterAll(async () => {
		await saveSettings(boss);
	});

	it('anomalias en un pago completado: no se confirma, no se cancela, queda nota', async () => {
		const cases = [
			[
				'monto',
				(id, p) => clipMock.tamper(id, { amount: (p.amount - 100) / 100 }),
				/monto distinto/
			],
			['moneda', (id) => clipMock.tamper(id, { currency: 'USD' }), /moneda distinta/],
			[
				'referencia',
				(id) => clipMock.tamper(id, { reference: 'TDA-zzzzzzzzzzzzzzz-AAAAAAAA' }),
				/referencia distinta/
			]
		];
		for (const [name, tamper, pattern] of cases) {
			const { id, payment, order } = await cardOrder();
			await tamper(id, payment);
			await clipMock.complete(id);
			await sendClipWebhook(clipEvent(id));
			const noted = await waitFor(async () => (await paymentOf(id)).provider_note);
			ok(`${name}: queda una nota para revisar`, pattern.test(noted ?? ''), noted);
			const p = await paymentOf(id);
			ok(
				`${name}: el personal ve la alerta en el detalle de la venta`,
				(await boss.get(`/admin/ventas/${order.id}`)).text.includes('payment-note')
			);
			ok(
				`${name}: pago y pedido siguen pendientes`,
				p.status === 'pending' && !p.receipt_no && (await orderOf(order)).status === 'pending'
			);
		}
	});

	it('completado pero Clip aun sin recibo: pendiente; con recibo: pagado', async () => {
		const { id, order } = await cardOrder();
		await clipMock.complete(id, 'none');
		await sendClipWebhook(clipEvent(id));
		await settle(700);
		ok('sin receipt_no sigue pendiente', (await orderOf(order)).status === 'pending');
		await clipMock.complete(id, 'RCPT-LATE-1');
		await sendClipWebhook(clipEvent(id));
		ok(
			'al llegar el recibo se confirma',
			!!(await waitFor(async () => (await orderOf(order)).status === 'paid'))
		);
		ok('se guarda el recibo', (await paymentOf(id)).receipt_no === 'RCPT-LATE-1');
	});

	it('un recibo no puede acreditar dos pedidos', async () => {
		const a = await cardOrder();
		const b = await cardOrder();
		await clipMock.complete(a.id, 'RCPT-DUP');
		await sendClipWebhook(clipEvent(a.id));
		await waitFor(async () => (await orderOf(a.order)).status === 'paid');
		await clipMock.complete(b.id, 'RCPT-DUP');
		await sendClipWebhook(clipEvent(b.id));
		await settle(900);
		ok(
			'el segundo pedido no se confirma con el mismo recibo y queda la nota',
			(await orderOf(b.order)).status === 'pending' &&
				(await paymentOf(b.id)).status === 'pending' &&
				/ya acredito otro pago/.test((await paymentOf(b.id)).provider_note)
		);
	});

	it('link vencido o cancelado en Clip: el intento falla, el pedido sigue pendiente', async () => {
		const { id, order } = await cardOrder();
		await clipMock.expire(id);
		await sendClipWebhook(clipEvent(id));
		ok(
			'vencido -> pago fallido',
			!!(await waitFor(async () => (await paymentOf(id)).status === 'failed'))
		);
		ok(
			'el pedido sigue pendiente (puede cambiar de metodo)',
			(await orderOf(order)).status === 'pending'
		);
	});

	it('la URL de retorno no prueba nada: se pregunta a Clip', async () => {
		const { id, order } = await cardOrder();
		const url = `/pedido/${order.code}?t=${encodeURIComponent(order.access_token)}`;
		const spoof = await client().get(`${url}&pago=ok&status=CHECKOUT_COMPLETED&success=true`);
		ok(
			'con parametros falsos sigue pendiente',
			spoof.status === 200 && (await orderOf(order)).status === 'pending'
		);
		await settle(2200); // minimo entre consultas a Clip
		await clipMock.complete(id);
		const real = await client().get(url);
		ok(
			'cuando Clip lo confirma, la pagina lo refleja',
			real.text.includes('Registramos tu pago') && (await orderOf(order)).status === 'paid'
		);
	});

	it('reconciliador: recupera un pago cuyo webhook se perdio', async () => {
		const { id, order } = await cardOrder();
		await clipMock.complete(id); // pagado en Clip, pero NUNCA llega el aviso
		await settle(300);
		ok('sin aviso sigue pendiente', (await orderOf(order)).status === 'pending');
		const r = runScript('scripts/jobs/reconcile-payments.js', [], clipEnv());
		ok('el script termina bien', r.status === 0, r.stdout + r.stderr);
		ok(
			'lo confirma',
			(await orderOf(order)).status === 'paid' && /pagados \d+/.test(r.stdout),
			r.stdout
		);
		ok('con recibo', /^RCPT-/.test((await paymentOf(id)).receipt_no));
		const again = runScript('scripts/jobs/reconcile-payments.js', [], clipEnv());
		ok('repetirlo no cambia nada', again.status === 0);
	});

	it('reconciliador: una anomalia no se pierde (el script sale con error)', async () => {
		const { id, payment, order } = await cardOrder();
		await clipMock.tamper(id, { amount: (payment.amount + 500) / 100 });
		await clipMock.complete(id);
		const r = runScript('scripts/jobs/reconcile-payments.js', [], clipEnv());
		ok(
			'sale con codigo != 0 y avisa',
			r.status === 1 && /anomalia/.test(r.stdout),
			r.stdout + r.stderr
		);
		ok('el pedido no se tocó', (await orderOf(order)).status === 'pending');
		ok('queda la nota', /monto distinto/.test((await paymentOf(id)).provider_note));
		const again = runScript('scripts/jobs/reconcile-payments.js', [], clipEnv());
		ok(
			'una anomalia ya senalada no repite la alarma en cada cron',
			again.status === 0,
			again.stdout
		);
	});

	it('vencimiento: un pedido pagado en Clip con webhook perdido NO se cancela', async () => {
		const su = await suPb();
		const { id, order } = await cardOrder();
		await su.collection('orders').update(order.id, { expires_at: '2020-01-01 00:00:00.000Z' });
		await clipMock.complete(id);
		const r = runScript('scripts/jobs/expire-orders.js', [], clipEnv());
		ok('el script termina bien', r.status === 0, r.stdout + r.stderr);
		const after = await orderOf(order);
		ok('quedo pagado, no cancelado', after.status === 'paid', after.status);

		// y uno realmente impago si vence
		const unpaid = await cardOrder();
		await su
			.collection('orders')
			.update(unpaid.order.id, { expires_at: '2020-01-01 00:00:00.000Z' });
		runScript('scripts/jobs/expire-orders.js', [], clipEnv());
		ok('el impago si se cancela', (await orderOf(unpaid.order)).status === 'cancelled');
	});

	it('producto de prueba de $1: seed idempotente y cobro exacto de $1.00 con tarjeta', async () => {
		const run = () => runScript('scripts/seed-clip-test.js');
		ok('el seed corre', run().status === 0);
		const again = run();
		ok('es idempotente', again.status === 0 && /Producto listo/.test(again.stdout), again.stderr);
		ok('hay un solo producto', (await count('products', 'slug="producto-prueba-1"')) === 1);
		ok(
			'la pagina del producto existe',
			(await client().get('/productos/producto-prueba-1')).status === 200
		);

		// con IVA y comision apagados el total es exactamente $1.00
		await saveSettings(boss, { 'tax.apply_iva': 'off', 'clip.apply_fee': 'off' });
		await clipMock.reset();
		const { id, payment, order } = await cardOrder('PRUEBA-1');
		const create = (await clipMock.requests()).find((q) => q.method === 'POST');
		ok(
			'Clip recibe amount 1 (MXN)',
			create.body.amount === 1 &&
				create.body.currency === 'MXN' &&
				payment.amount === 100 &&
				order.total === 100,
			`${create.body.amount} ${payment.amount}`
		);
		await clipMock.complete(id);
		await sendClipWebhook(clipEvent(id));
		ok(
			'se confirma el pago de $1',
			!!(await waitFor(async () => (await orderOf(order)).status === 'paid'))
		);
		await saveSettings(boss, { 'clip.apply_fee': 'on' });
	});

	it('clip:check crea un link y reporta; sin credenciales avisa', async () => {
		const r = runScript('scripts/clip-check.js', [], clipEnv());
		ok(
			'crea el link y lo imprime',
			r.status === 0 &&
				/Clip acepto las credenciales/.test(r.stdout) &&
				/pagar en:\s+http/.test(r.stdout),
			r.stdout + r.stderr
		);
		const id = r.stdout.match(/id:\s+([0-9a-f-]{36})/)?.[1];
		const q = runScript('scripts/clip-check.js', ['--id', id], clipEnv());
		ok(
			'consulta un link existente',
			q.status === 0 && /CHECKOUT_CREATED/.test(q.stdout),
			q.stdout + q.stderr
		);
		ok(
			'monto invalido',
			runScript('scripts/clip-check.js', ['--amount', '0.5'], clipEnv()).status === 1
		);
		const none = runScript('scripts/clip-check.js', [], {
			CLIP_API_KEY: '',
			CLIP_API_SECRET: '',
			CLIP_API_TOKEN: '',
			CLIP_WEBHOOK_TOKEN: ''
		});
		ok('sin configurar sale con 2', none.status === 2);
		const bad = runScript('scripts/clip-check.js', [], { ...clipEnv(), CLIP_API_SECRET: 'mala' });
		ok(
			'credenciales incorrectas: 401 explicado',
			bad.status === 1 && /401/.test(bad.stderr),
			bad.stderr
		);
	});

	it('los scripts avisan si Clip no esta configurado', async () => {
		const r = runScript('scripts/jobs/reconcile-payments.js', [], {
			CLIP_API_KEY: '',
			CLIP_API_SECRET: '',
			CLIP_WEBHOOK_TOKEN: '',
			CLIP_API_TOKEN: ''
		});
		ok('termina sin error', r.status === 0 && /no esta configurado/.test(r.stdout), r.stdout);
	});

	it('webhook: limite de peticiones por IP', async () => {
		const send = () =>
			raw(`/api/webhooks/clip?token=${encodeURIComponent(cfg.clipWebhookToken)}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-forwarded-proto': 'http',
					'x-forwarded-for': '10.77.77.77'
				},
				body: JSON.stringify({ hola: 1 })
			});
		let last;
		let limited = 0;
		for (let i = 0; i < 130; i++) {
			last = await send();
			if (last.status === 429) limited += 1;
		}
		ok('despues de 120 por minuto responde 429', limited >= 5 && last.status === 429, `${limited}`);
		// otra IP no se ve afectada
		ok('otra IP sigue bien', (await sendClipWebhook(clipEvent('no-es-uuid'))).status === 200);
	});
});
