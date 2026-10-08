import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeTotals } from '#core/pricing.js';
import { formatMoney } from '#core/money.js';
import {
	PNG,
	cfg,
	cartWith,
	client,
	clipMock,
	count,
	enabled,
	first,
	ok,
	orderByCode,
	parseOrderLocation,
	raw,
	runScript,
	saveSettings,
	sendClipWebhook,
	staff,
	stockOf,
	su as suPb
} from './support.js';

const NBSP = new RegExp(String.fromCharCode(160), 'g');
const m = (cents) => formatMoney(cents).replace(NBSP, ' ');
const plain = (r) =>
	r.text
		.replace(NBSP, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ');
const PRICING = {
	applyIva: true,
	ivaBp: 1600,
	applyFee: true,
	feeBp: 290,
	feeFixed: 0,
	discountNonCard: true
};
const contact = { name: 'Ana López', email: 'ana@correo.test', phone: '55 1234 5678' };
const TRANSFER = {
	'transfer.beneficiary': 'Mi Tienda SA',
	'transfer.bank': 'Banco Prueba',
	'transfer.clabe': '012345678901234567',
	'transfer.instructions': 'Envía tu comprobante'
};

/** Hace el checkout y devuelve la respuesta + el pedido (si lo hubo). */
async function checkout(browser, method, extra = {}) {
	const res = await browser.post('/checkout', { ...contact, method, ...extra });
	return { res, loc: parseOrderLocation(res.location) };
}
const clipId = (location) => String(location).match(/\/pay\/(req-\d+)$/)?.[1];

describe.skipIf(!enabled)('pedidos: checkout, transferencia, tarjeta (Clip) y vencimiento', () => {
	let boss;
	beforeAll(async () => {
		boss = await staff('boss');
		await saveSettings(boss, { 'clip.apply_fee': 'on', ...TRANSFER });
		await clipMock.reset();
	});
	afterAll(async () => {
		await saveSettings(boss);
	});

	it('transferencia como invitado: pedido, stock, finanzas internas y pagina del pedido', async () => {
		const stockBefore = await stockOf('TAZ-CER');
		const b = await cartWith([
			['TAZ-CER', 2],
			['GOR-NEG', 1]
		]);

		let r = await b.get('/checkout');
		ok(
			'el checkout muestra ambos metodos y los totales por metodo',
			r.status === 200 &&
				r.text.includes('Tarjeta de crédito o débito') &&
				r.text.includes('Transferencia bancaria')
		);
		const base = 14_900 * 2 + 19_900;
		const card = computeTotals({
			baseCents: base,
			method: 'card_clip',
			config: PRICING
		}).customerView;
		const transfer = computeTotals({
			baseCents: base,
			method: 'transfer',
			config: PRICING
		}).customerView;
		ok(
			'...con el precio de cada metodo (la transferencia, mas barata)',
			plain(r).includes(m(card.total)) &&
				plain(r).includes(m(transfer.total)) &&
				transfer.total < card.total
		);

		const { res, loc } = await checkout(b, 'transfer');
		ok(
			'confirmar -> 303 a /pedido con codigo y token',
			res.status === 303 && !!loc && loc.token.length >= 40,
			`${res.status} ${res.location}`
		);
		ok('el carrito queda vacio', (await b.get('/carrito')).text.includes('Tu carrito está vacío'));

		const order = await orderByCode(loc.code);
		ok(
			'pedido pendiente web con el total del metodo y contacto',
			order.status === 'pending' &&
				order.channel === 'web' &&
				order.payment_method === 'transfer' &&
				order.total === transfer.total &&
				order.discount === transfer.discount &&
				order.tax_total === transfer.iva &&
				order.contact_email === contact.email &&
				!!order.expires_at &&
				!order.customer
		);
		const su = await suPb();
		const items = await su.collection('order_items').getFullList({ filter: `order="${order.id}"` });
		ok(
			'lineas con instantanea y total repartido',
			items.length === 2 &&
				items.reduce((s, i) => s + i.line_total, 0) === order.total &&
				items.find((i) => i.sku === 'TAZ-CER').quantity === 2 &&
				items.find((i) => i.sku === 'TAZ-CER').unit_base === 14_900
		);
		const fin = await first('order_financials', `order="${order.id}"`);
		ok(
			'finanzas internas: base, tasas usadas, sin comision (no es tarjeta)',
			fin.base_total === base &&
				fin.tax_rate_bp === 1600 &&
				fin.fee_rate_bp === 290 &&
				fin.fee_applied === true &&
				fin.fee_total === 0 &&
				fin.net_total === order.total - order.tax_total
		);
		const payment = await first('payments', `order="${order.id}"`);
		ok(
			'pago pendiente por transferencia',
			payment.status === 'pending' &&
				payment.method === 'transfer' &&
				payment.amount === order.total
		);
		ok('stock reservado', (await stockOf('TAZ-CER')) === stockBefore - 2);

		// ---- la pagina del pedido
		const url = `/pedido/${loc.code}?t=${encodeURIComponent(loc.token)}`;
		r = await b.get(url);
		ok(
			'pagina con estado, CLABE, referencia y total',
			r.status === 200 &&
				r.text.includes('Pendiente de pago') &&
				r.text.includes('012345678901234567') &&
				r.text.includes(loc.code) &&
				plain(r).includes(m(order.total)) &&
				plain(r).includes('Banco Prueba')
		);
		ok(
			'desglose para el cliente: subtotal, descuento, IVA',
			plain(r).includes(m(transfer.subtotal)) &&
				new RegExp(`Descuento\\s*−\\s*${m(transfer.discount).replace('$', '\\$')}`).test(plain(r))
		);
		ok(
			'sin finanzas ni token en el HTML ni en los datos',
			!/fee_total|net_total|base_total|unit_base|clipFee|access_token|"financials"/.test(r.text) &&
				!/comisi/i.test(r.text)
		);

		// ---- acceso
		const anon = client();
		ok('sin token -> 404', (await anon.get(`/pedido/${loc.code}`)).status === 404);
		ok('token incorrecto -> 404', (await anon.get(`/pedido/${loc.code}?t=otro`)).status === 404);
		ok('codigo mal formado -> 404', (await anon.get('/pedido/hola?t=x')).status === 404);
		ok(
			'codigo inexistente -> 404',
			(await anon.get(`/pedido/W-20000101-ZZZZZ?t=${loc.token}`)).status === 404
		);
		ok(
			'el personal con orders:read lo ve sin token',
			(await boss.get(`/pedido/${loc.code}`)).status === 200
		);
		ok(
			'un cajero (sin orders:read) no',
			(await (await staff('caja')).get(`/pedido/${loc.code}`)).status === 404
		);

		// ---- cancelar libera el stock; una segunda vez no hace nada
		r = await anon.post(`/pedido/${loc.code}?/cancel&t=${encodeURIComponent(loc.token)}`, {});
		ok(
			'el cliente cancela con su token',
			r.status === 303 && (await orderByCode(loc.code)).status === 'cancelled'
		);
		ok('el stock regresa', (await stockOf('TAZ-CER')) === stockBefore);
		ok(
			'el pago pendiente queda fallido',
			(await first('payments', `order="${order.id}"`)).status === 'failed'
		);
		await anon.post(`/pedido/${loc.code}?/cancel&t=${encodeURIComponent(loc.token)}`, {});
		ok('cancelar dos veces no repone stock dos veces', (await stockOf('TAZ-CER')) === stockBefore);
		ok(
			'la pagina muestra Cancelado',
			(await anon.get(url)).text.includes('Este pedido fue cancelado')
		);
	});

	it('validaciones del checkout y proteccion contra manipulacion', async () => {
		const stock = await stockOf('GOR-AZU');
		const b = await cartWith([['GOR-AZU', 1]]);
		let { res } = await checkout(b, 'transfer', { email: 'no-es-correo' });
		ok(
			'correo invalido -> 400 con mensaje',
			res.status === 400 && res.text.includes('Escribe un correo válido')
		);
		({ res } = await checkout(b, 'transfer', { name: '' }));
		ok('nombre vacio -> 400', res.status === 400 && res.text.includes('Escribe tu nombre'));
		({ res } = await checkout(b, 'transfer', { phone: 'abc' }));
		ok('telefono invalido -> 400', res.status === 400);
		({ res } = await checkout(b, ''));
		ok('sin metodo -> 400', res.status === 400 && res.text.includes('Elige cómo quieres pagar'));
		({ res } = await checkout(b, 'cash'));
		ok(
			'efectivo no existe en la web (aunque se fuerce el formulario)',
			res.status === 400 && res.text.includes('El efectivo solo está disponible en tienda')
		);
		({ res } = await checkout(b, 'bitcoin'));
		ok('metodo inventado -> 400', res.status === 400);
		ok(
			'nada se creo ni se reservo',
			(await stockOf('GOR-AZU')) === stock &&
				(await count('orders', `contact_email="${contact.email}" && status="pending"`)) === 0
		);

		const empty = client();
		ok(
			'checkout con carrito vacio -> carrito',
			(await empty.get('/checkout')).location === '/carrito'
		);
		const forged = await raw('/checkout', {
			method: 'POST',
			headers: {
				origin: 'http://evil.example',
				'x-forwarded-proto': 'http',
				'content-type': 'application/x-www-form-urlencoded'
			},
			body: 'name=x'
		});
		ok('CSRF -> 403', forged.status === 403);

		// el cliente no puede fijar precios: el servidor recalcula; campos extra se ignoran
		({ res } = await checkout(b, 'transfer', { total: '1', price: '1', 'items.0.unit_base': '1' }));
		const loc = parseOrderLocation(res.location);
		const order = await orderByCode(loc.code);
		const expected = computeTotals({ baseCents: 19_900, method: 'transfer', config: PRICING })
			.customerView.total;
		ok('el total sale del servidor, no del formulario', order.total === expected && expected > 1);
		await b.post(`/pedido/${loc.code}?/cancel&t=${encodeURIComponent(loc.token)}`, {});
	});

	it('la ultima pieza: dos compradores a la vez, solo uno se la lleva', async () => {
		const su = await suPb();
		const v = await first('variants', 'sku="MOC-URB"');
		await su.collection('variants').update(v.id, { stock: 1 });
		const [a, b] = await Promise.all([cartWith([['MOC-URB', 1]]), cartWith([['MOC-URB', 1]])]);
		const [ra, rb] = await Promise.all([
			checkout(a, 'transfer'),
			checkout(b, 'transfer', { email: 'otro@correo.test' })
		]);
		const winners = [ra, rb].filter((x) => x.loc);
		const losers = [ra, rb].filter((x) => !x.loc);
		ok(
			'exactamente uno compra y el otro vuelve al carrito con el aviso',
			winners.length === 1 &&
				losers.length === 1 &&
				losers[0].res.location === '/carrito' &&
				/Ya no hay suficientes piezas|se agotó|Solo quedan/.test(losers[0].res.flash ?? ''),
			`${ra.res.status}/${rb.res.status} ${losers[0]?.res.flash}`
		);
		ok(
			'stock en 0 (nunca negativo) y un solo pedido',
			(await stockOf('MOC-URB')) === 0 &&
				(await count('order_items', `sku="MOC-URB" && order.status="pending"`)) === 1
		);
		await winners[0].res.status;
		const w = winners[0];
		await client().post(`/pedido/${w.loc.code}?/cancel&t=${encodeURIComponent(w.loc.token)}`, {});
		ok('al cancelar vuelve la pieza', (await stockOf('MOC-URB')) === 1);
		await su.collection('variants').update(v.id, { stock: 6 }); // valor original del seed
	});

	it('tarjeta con Clip: link, webhook idempotente, aviso falso y consulta al volver', async () => {
		await clipMock.reset();
		const b = await cartWith([['TAZ-CER', 1]]);
		const { res } = await checkout(b, 'card_clip');
		const id = clipId(res.location);
		ok(
			'el checkout redirige al link de pago de Clip',
			res.status === 303 && !!id && res.location.startsWith(cfg.clipUrl),
			res.location
		);

		const reqs = await clipMock.requests();
		const create = reqs.find((r) => r.method === 'POST');
		const card = computeTotals({
			baseCents: 14_900,
			method: 'card_clip',
			config: PRICING
		}).customerView;
		ok(
			'Clip recibio: Basic auth, monto en pesos con la comision integrada, MXN',
			create.auth.startsWith('Basic ') &&
				create.body.amount === card.total / 100 &&
				create.body.currency === 'MXN'
		);
		const order = await first(
			'orders',
			`payment_method="card_clip" && status="pending" && total=${card.total}`
		);
		ok(
			'URLs de retorno y webhook con token',
			create.body.redirection_url.success.includes(`/pedido/${order.code}?t=`) &&
				create.body.redirection_url.error.includes('pago=error') &&
				create.body.webhook_url.endsWith(`/api/webhooks/clip?token=${cfg.clipWebhookToken}`) &&
				create.body.purchase_description === `Pedido ${order.code}`
		);
		const payment = await first('payments', `order="${order.id}"`);
		ok(
			'el pago guarda la referencia y el link',
			payment.provider_ref === id &&
				payment.provider_url === res.location &&
				payment.status === 'pending'
		);
		const fin = await first('order_financials', `order="${order.id}"`);
		ok(
			'finanzas: comision estimada y neto = precio guardado',
			fin.fee_total > 0 && Math.abs(fin.net_total - 14_900) <= 1,
			`${fin.fee_total} ${fin.net_total}`
		);

		const tokenParam = order.access_token;
		let r = await client().get(`/pedido/${order.code}?t=${encodeURIComponent(tokenParam)}`);
		ok(
			'la pagina ofrece pagar con el link y no menciona la comision',
			r.text.includes(res.location) && !/comisi/i.test(r.text)
		);

		// ---- seguridad del webhook
		ok(
			'sin token -> 403',
			(await sendClipWebhook({ payment_request_id: id }, { token: null })).status === 403
		);
		ok(
			'token incorrecto -> 403',
			(await sendClipWebhook({ payment_request_id: id }, { token: 'mal' })).status === 403
		);
		ok(
			'JSON invalido -> 400',
			(await sendClipWebhook(null, { body: '{no es json' })).status === 400
		);
		ok(
			'solicitud desconocida -> 200 sin cambios',
			JSON.parse(
				(await sendClipWebhook({ payment_request_id: 'req-999', resource_status: 'COMPLETED' }))
					.text
			).status === 'unknown'
		);
		ok(
			'sin payment_request_id -> 200 ignorado',
			JSON.parse((await sendClipWebhook({ hola: 1 })).text).status === 'ignored'
		);

		// ---- un aviso FALSO no paga nada: Clip todavia dice "creado"
		r = await sendClipWebhook({
			id: 'evt-fake',
			payment_request_id: id,
			resource_status: 'COMPLETED'
		});
		ok(
			'aviso que dice COMPLETED pero Clip no lo confirma: sigue pendiente',
			JSON.parse(r.text).status === 'pending' &&
				(await orderByCode(order.code)).status === 'pending'
		);

		// ---- pago real
		await clipMock.complete(id);
		r = await sendClipWebhook({
			id: 'evt-1',
			payment_request_id: id,
			resource_status: 'COMPLETED',
			transaction_id: 'tx'
		});
		ok(
			'webhook verificado con Clip -> pedido pagado',
			r.status === 200 &&
				JSON.parse(r.text).changed === true &&
				(await orderByCode(order.code)).status === 'paid'
		);
		const paid = await first('payments', `order="${order.id}"`);
		ok(
			'pago confirmado con el id del evento y la fecha',
			paid.status === 'confirmed' &&
				paid.provider_event_id === 'evt-1' &&
				!!paid.confirmed_at &&
				!!(await orderByCode(order.code)).paid_at
		);

		// ---- idempotencia
		const before = await first('orders', `id="${order.id}"`);
		for (const eventId of ['evt-1', 'evt-1', 'evt-2']) {
			const again = await sendClipWebhook({
				id: eventId,
				payment_request_id: id,
				resource_status: 'COMPLETED'
			});
			ok(
				`reenvio (${eventId}) responde 200 sin cambiar nada`,
				again.status === 200 && JSON.parse(again.text).changed === false
			);
		}
		ok(
			'el pedido sigue igual',
			(await first('orders', `id="${order.id}"`)).updated === before.updated
		);
		ok(
			'la pagina muestra Pagado y gracias',
			(
				await client().get(`/pedido/${order.code}?t=${encodeURIComponent(tokenParam)}`)
			).text.includes('Registramos tu pago')
		);

		// ---- cliente regresa de pagar y el aviso aun no llego: la pagina le pregunta a Clip
		const b2 = await cartWith([['TAZ-CER', 1]]);
		const c2 = await checkout(b2, 'card_clip');
		const id2 = clipId(c2.res.location);
		const o2 = await first('payments', `provider_ref="${id2}"`);
		const order2 = await (await suPb()).collection('orders').getOne(o2.order);
		await clipMock.complete(id2);
		r = await client().get(`/pedido/${order2.code}?t=${encodeURIComponent(order2.access_token)}`);
		ok(
			'sin webhook, al volver a la pagina se confirma consultando a Clip',
			r.text.includes('Registramos tu pago') && (await orderByCode(order2.code)).status === 'paid'
		);
	});

	it('tarjeta: fallos de Clip, link cancelado, cambio de metodo y pago tardio', async () => {
		const su = await suPb();
		const stock = await stockOf('GOR-NEG');

		// ---- Clip caido al crear el link: no queda pedido ni stock reservado
		await clipMock.failNext();
		const b = await cartWith([['GOR-NEG', 1]]);
		let { res } = await checkout(b, 'card_clip');
		ok(
			'si Clip falla: aviso claro y 400',
			res.status === 400 && res.text.includes('No pudimos generar el pago con tarjeta')
		);
		ok(
			'el pedido queda cancelado y el stock liberado',
			(await stockOf('GOR-NEG')) === stock &&
				(await count(
					'orders',
					`payment_method="card_clip" && status="cancelled" && notes~"generar el pago"`
				)) >= 1
		);

		// ---- link cancelado en Clip: el intento falla pero el pedido sigue pendiente
		({ res } = await checkout(b, 'card_clip'));
		const id = clipId(res.location);
		const payment = await first('payments', `provider_ref="${id}"`);
		const order = await su.collection('orders').getOne(payment.order);
		await clipMock.cancel(id);
		let r = await sendClipWebhook({
			id: 'evt-c',
			payment_request_id: id,
			resource_status: 'CANCELLED'
		});
		ok(
			'webhook de link cancelado -> pago fallido, pedido pendiente',
			JSON.parse(r.text).status === 'failed' &&
				(await first('payments', `id="${payment.id}"`)).status === 'failed' &&
				(await orderByCode(order.code)).status === 'pending'
		);

		// ---- el cliente cambia a transferencia: recalcula con las tasas del pedido
		const cust = client();
		const q = `t=${encodeURIComponent(order.access_token)}`;
		r = await cust.post(`/pedido/${order.code}?/change&${q}`, { method: 'transfer' });
		const changed = await orderByCode(order.code);
		const expected = computeTotals({
			baseCents: 19_900,
			method: 'transfer',
			config: PRICING
		}).customerView;
		ok(
			'cambio a transferencia: total con descuento',
			r.status === 303 &&
				changed.payment_method === 'transfer' &&
				changed.total === expected.total &&
				changed.discount === expected.discount,
			`${changed.total} vs ${expected.total}`
		);
		const payments = await su
			.collection('payments')
			.getFullList({ filter: `order="${order.id}"`, sort: 'created' });
		ok(
			'queda un pago de tarjeta fallido y uno de transferencia pendiente',
			payments.length === 2 &&
				payments[0].status === 'failed' &&
				payments[1].method === 'transfer' &&
				payments[1].status === 'pending' &&
				payments[1].amount === expected.total
		);
		const fin = await first('order_financials', `order="${order.id}"`);
		ok('finanzas actualizadas (ya sin comision)', fin.fee_total === 0);
		r = await cust.get(`/pedido/${order.code}?${q}`);
		ok('la pagina ahora muestra la transferencia', r.text.includes('012345678901234567'));

		// ---- aplicar un cambio que no corresponde
		ok(
			'no se puede "cambiar" al mismo metodo ni a efectivo',
			(await cust.post(`/pedido/${order.code}?/change&${q}`, { method: 'cash' })).status === 400
		);

		// ---- el pedido se cancela y el pago de Clip llega tarde: no se reabre, queda constancia
		await cartWith([['GOR-NEG', 1]], b);
		const pay2 = await b.post('/checkout', { ...contact, method: 'card_clip' });
		const id2 = clipId(pay2.location);
		const late = await su.collection('payments').getFirstListItem(`provider_ref="${id2}"`);
		const lateOrder = await su.collection('orders').getOne(late.order);
		await cust.post(
			`/pedido/${lateOrder.code}?/cancel&t=${encodeURIComponent(lateOrder.access_token)}`,
			{}
		);
		await clipMock.complete(id2);
		r = await sendClipWebhook({
			id: 'evt-late',
			payment_request_id: id2,
			resource_status: 'COMPLETED'
		});
		const afterLate = await su.collection('orders').getOne(lateOrder.id);
		ok(
			'pago tardio: el pedido sigue cancelado pero queda marcado para revisar',
			JSON.parse(r.text).status === 'paid' &&
				afterLate.status === 'cancelled' &&
				/reembolsar/.test(afterLate.notes) &&
				(await su.collection('payments').getOne(late.id)).status === 'confirmed'
		);

		await cust.post(`/pedido/${order.code}?/cancel&${q}`, {});
		expect(true).toBe(true);
	});

	it('comprobante de transferencia', async () => {
		const b = await cartWith([['TAZ-CER', 1]]);
		const { loc } = await checkout(b, 'transfer');
		const q = `t=${encodeURIComponent(loc.token)}`;
		let r = await b.multipart(
			`/pedido/${loc.code}?/proof&${q}`,
			[],
			[{ name: 'proof', filename: 'comprobante.png', type: 'image/png', data: PNG }]
		);
		const order = await orderByCode(loc.code);
		const payment = await first('payments', `order="${order.id}"`);
		ok('el comprobante se guarda en el pago', r.status === 303 && !!payment.proof);
		r = await b.get(`/pedido/${loc.code}?${q}`);
		ok('la pagina avisa que ya lo recibimos', r.text.includes('Ya recibimos un comprobante'));
		r = await b.multipart(
			`/pedido/${loc.code}?/proof&${q}`,
			[],
			[
				{
					name: 'proof',
					filename: 'x.exe',
					type: 'application/x-msdownload',
					data: Buffer.from('MZ')
				}
			]
		);
		ok('tipo de archivo no permitido -> 400', r.status === 400 && r.text.includes('imagen'));
		r = await b.multipart(
			`/pedido/${loc.code}?/proof&${q}`,
			[],
			[
				{
					name: 'proof',
					filename: 'grande.png',
					type: 'image/png',
					data: Buffer.alloc(6 * 1024 * 1024, 1)
				}
			]
		);
		ok('archivo mayor a 5 MB -> 400', r.status === 400 && r.text.includes('5 MB'));
		r = await b.multipart(
			`/pedido/${loc.code}?/proof`,
			[],
			[{ name: 'proof', filename: 'c.png', type: 'image/png', data: PNG }]
		);
		ok('sin token no se puede subir nada', r.status === 404);
		// el comprobante es privado: PocketBase no lo sirve sin token de archivo
		const publicUrl = `${cfg.pbUrl}/api/files/payments/${payment.id}/${payment.proof}`;
		ok(
			'el archivo esta protegido en PocketBase (sin token no se sirve)',
			(await fetch(publicUrl)).status >= 400
		);
		await b.post(`/pedido/${loc.code}?/cancel&${q}`, {});
	});

	it('vencimiento: el job cancela lo vencido y repone el stock', async () => {
		const su = await suPb();
		const stock = await stockOf('TAZ-CER');
		const b1 = await cartWith([['TAZ-CER', 3]]);
		const b2 = await cartWith([['TAZ-CER', 1]]);
		const { loc: expired } = await checkout(b1, 'transfer');
		const { loc: fresh } = await checkout(b2, 'transfer');
		ok('reservaron stock', (await stockOf('TAZ-CER')) === stock - 4);

		// uno ya vencio; el otro no
		await su
			.collection('orders')
			.update((await orderByCode(expired.code)).id, { expires_at: '2020-01-01 00:00:00.000Z' });
		// y uno pagado nunca vence aunque tenga fecha vieja
		const paidOrder = await orderByCode(fresh.code);
		const res = runScript('scripts/jobs/expire-orders.js');
		ok(
			'el script termina bien y reporta',
			res.status === 0 && /cancelados: 1/.test(res.stdout),
			res.stdout + res.stderr
		);
		const after = await orderByCode(expired.code);
		ok(
			'el vencido queda cancelado con motivo',
			after.status === 'cancelled' && /Venció/.test(after.notes)
		);
		ok('el vigente sigue pendiente', (await orderByCode(fresh.code)).status === 'pending');
		ok('se repone solo el stock del vencido', (await stockOf('TAZ-CER')) === stock - 1);
		ok(
			'correr de nuevo no cancela nada mas',
			/cancelados: 0/.test(runScript('scripts/jobs/expire-orders.js').stdout)
		);
		void paidOrder;
		await client().post(`/pedido/${fresh.code}?/cancel&t=${encodeURIComponent(fresh.token)}`, {});
		ok('todo el stock repuesto', (await stockOf('TAZ-CER')) === stock);
	});
});
