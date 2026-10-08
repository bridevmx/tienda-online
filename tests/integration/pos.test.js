import { afterAll, beforeAll, describe, it } from 'vitest';
import { computeTotals } from '#core/pricing.js';
import { formatMoney } from '#core/money.js';
import {
	cartWith,
	client,
	clipMock,
	count,
	enabled,
	first,
	ok,
	orderByCode,
	parseOrderLocation,
	saveSettings,
	staff,
	stockOf,
	waitFor
} from './support.js';

const NBSP = new RegExp(String.fromCharCode(160), 'g');
const plain = (r) =>
	r.text
		.replace(NBSP, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ');
const money = (c) => formatMoney(c).replace(NBSP, ' ');
const PRICING = {
	applyIva: true,
	ivaBp: 1600,
	applyFee: true,
	feeBp: 290,
	feeFixed: 0,
	discountNonCard: true
};
const TRANSFER = {
	'transfer.beneficiary': 'Mi Tienda SA',
	'transfer.bank': 'Banco Prueba',
	'transfer.clabe': '012345678901234567'
};

describe.skipIf(!enabled)('TPV', () => {
	let boss, caja, ger, tazaId, gorraId, cajaUser;
	const lines = (...l) => JSON.stringify(l.map(([variant, qty]) => ({ variant, qty })));
	const charge = (b, fields) => b.post('/tpv?/charge', fields);

	beforeAll(async () => {
		[boss, caja, ger] = await Promise.all([staff('boss'), staff('caja'), staff('ger')]);
		await saveSettings(boss, { 'clip.apply_fee': 'on', ...TRANSFER });
		await clipMock.reset();
		tazaId = (await first('variants', 'sku="TAZ-CER"')).id;
		gorraId = (await first('variants', 'sku="GOR-NEG"')).id;
		cajaUser = await first('users', 'email="caja@test.local"');
	});
	afterAll(async () => {
		await saveSettings(boss);
	});

	it('acceso: solo personal con pos:use', async () => {
		const anon = await client().get('/tpv');
		ok(
			'anonimo -> login con next',
			anon.status === 303 && anon.location.startsWith('/admin/entrar?next=%2Ftpv'),
			anon.location
		);
		ok('cajero entra', (await caja.get('/tpv')).status === 200);
		ok('gerente entra', (await ger.get('/tpv')).status === 200);
		ok('/tpv/ventas tambien', (await caja.get('/tpv/ventas')).status === 200);

		const c = client();
		const login = await c.post('/admin/entrar?next=%2Ftpv%2Fventas', {
			email: 'caja@test.local',
			password: 'Caja-pass-1234'
		});
		ok(
			'el login vuelve al TPV',
			login.status === 303 && login.location === '/tpv/ventas',
			login.location
		);
		const evil = await client().post('/admin/entrar?next=https%3A%2F%2Fevil.test', {
			email: 'caja@test.local',
			password: 'Caja-pass-1234'
		});
		ok('next externo se ignora', evil.status === 303 && evil.location === '/admin', evil.location);
	});

	it('la pantalla trae el catálogo para buscar y escanear', async () => {
		const r = await caja.get('/tpv');
		ok('SKUs en la pagina', r.text.includes('TAZ-CER') && r.text.includes('GOR-NEG'));
		ok(
			'buscador y boton cobrar',
			r.text.includes('Buscar o escanear') && r.text.includes('pos-charge')
		);
	});

	it('efectivo: venta pagada al momento, cambio en el ticket, stock descontado', async () => {
		const before = await stockOf('TAZ-CER');
		const base = 14_900 * 2;
		const cash = computeTotals({ baseCents: base, method: 'cash', config: PRICING }).customerView;
		const received = Math.ceil(cash.total / 10_000) * 10_000;
		const r = await charge(caja, {
			lines: lines([tazaId, 2]),
			method: 'cash',
			received: String(received),
			name: '',
			email: ''
		});
		const loc = String(r.location).match(
			/^\/tpv\/ventas\/([A-Z]-\d{8}-[A-Z0-9]+)\?recibido=(\d+)$/
		);
		ok('redirige al ticket', r.status === 303 && !!loc, `${r.status} ${r.location}`);

		const order = await orderByCode(loc[1]);
		ok(
			'pedido pos pagado, del cajero, con precio de efectivo',
			order.channel === 'pos' &&
				order.status === 'paid' &&
				order.payment_method === 'cash' &&
				order.created_by === cajaUser.id &&
				order.total === cash.total &&
				order.discount === cash.discount
		);
		ok('stock descontado', (await stockOf('TAZ-CER')) === before - 2);
		ok('pago confirmado', (await first('payments', `order="${order.id}"`)).status === 'confirmed');

		const t = await caja.get(r.location);
		ok(
			'ticket con total, recibido y cambio',
			t.status === 200 &&
				plain(t).includes(money(cash.total)) &&
				plain(t).includes(`Cambio ${money(received - cash.total)}`) &&
				plain(t).includes('Descuento')
		);
		ok('el ticket no menciona comisiones ni finanzas', !/comisi|fee_total|net_total/i.test(t.text));
		ok('el gerente tambien lo ve', (await ger.get(`/tpv/ventas/${loc[1]}`)).status === 200);
	});

	it('transferencia: se confirma al momento', async () => {
		const r = await charge(caja, {
			lines: lines([gorraId, 1]),
			method: 'transfer',
			name: 'Luis',
			email: 'luis@correo.test'
		});
		const code = String(r.location).match(/\/tpv\/ventas\/([^?]+)/)?.[1];
		const order = await orderByCode(code);
		ok(
			'pagado y con contacto',
			order.status === 'paid' &&
				order.payment_method === 'transfer' &&
				order.contact_email === 'luis@correo.test'
		);
	});

	it('tarjeta: link de Clip con QR, se paga y se confirma; cancelar libera stock', async () => {
		const before = await stockOf('TAZ-CER');
		const card = computeTotals({
			baseCents: 14_900,
			method: 'card_clip',
			config: PRICING
		}).customerView;
		let r = await charge(caja, { lines: lines([tazaId, 1]), method: 'card_clip' });
		const code = String(r.location).match(/\/tpv\/ventas\/([^?]+)/)?.[1];
		ok('redirige al ticket', r.status === 303 && !!code, r.location);
		let order = await orderByCode(code);
		ok('pendiente con total de tarjeta', order.status === 'pending' && order.total === card.total);
		ok('stock reservado', (await stockOf('TAZ-CER')) === before - 1);

		let t = await caja.get(r.location);
		ok(
			'muestra el QR y espera',
			t.text.includes('pos-qr') && t.text.includes('<svg') && t.text.includes('Esperando el pago')
		);

		const pay = await first('payments', `order="${order.id}"`);
		await clipMock.complete(pay.provider_ref);
		// la pantalla consulta cada pocos segundos (con un minimo de 2 s entre consultas a Clip)
		t = await waitFor(
			async () => {
				const page = await caja.get(r.location);
				return page.text.includes('Pagado') ? page : null;
			},
			{ ms: 6000, every: 500 }
		);
		ok(
			'al consultar, Clip confirma y el ticket queda pagado',
			!!t && !t.text.includes('Esperando el pago') && t.text.includes('Pagado')
		);
		order = await orderByCode(code);
		ok('pedido pagado', order.status === 'paid');

		// otro cobro con tarjeta: cancelar
		r = await charge(caja, { lines: lines([tazaId, 1]), method: 'card_clip' });
		const code2 = String(r.location).match(/\/tpv\/ventas\/([^?]+)/)?.[1];
		const mid = await stockOf('TAZ-CER');
		const c = await caja.post(`/tpv/ventas/${code2}?/cancel`, {});
		ok('cancelar vuelve al TPV', c.status === 303 && c.location === '/tpv');
		ok(
			'cancelado y stock repuesto',
			(await orderByCode(code2)).status === 'cancelled' && (await stockOf('TAZ-CER')) === mid + 1
		);
	});

	it('validaciones: sin stock, ticket vacío, JSON roto, método no disponible', async () => {
		const stock = await stockOf('TAZ-CER');
		const orders = await count('orders', '');
		let r = await charge(caja, { lines: lines([tazaId, Math.min(99, stock + 1)]), method: 'cash' });
		ok(
			'sin stock -> 400 con mensaje',
			r.status === 400 && /Solo quedan|se agotó/.test(r.text),
			r.status
		);
		r = await charge(caja, { lines: '[]', method: 'cash' });
		ok('ticket vacio', r.status === 400 && r.text.includes('El ticket está vacío'));
		r = await charge(caja, { lines: '{roto', method: 'cash' });
		ok('JSON roto', r.status === 400);
		r = await charge(caja, { lines: lines([tazaId, 1]), method: 'bitcoin' });
		ok('metodo invalido', r.status === 400);
		ok(
			'nada se creo ni se desconto',
			(await count('orders', '')) === orders && (await stockOf('TAZ-CER')) === stock
		);

		await saveSettings(boss, { 'transfer.clabe': '' });
		r = await charge(caja, { lines: lines([tazaId, 1]), method: 'transfer' });
		ok('transferencia sin CLABE configurada', r.status === 400);
		await saveSettings(boss, { 'clip.apply_fee': 'on', ...TRANSFER });
	});

	it('mis ventas: el turno del cajero y aislamiento entre cajeros', async () => {
		const r = await caja.get('/tpv/ventas');
		ok(
			'lista y resumen',
			r.status === 200 && r.text.includes('shift-total') && r.text.includes('shift-orders')
		);
		const mine = await first('orders', `created_by="${cajaUser.id}" && payment_method="cash"`);
		ok('aparece una venta propia', r.text.includes(mine.code));

		const other = await ger.get('/tpv/ventas');
		ok(
			'otro usuario no ve las del cajero',
			other.status === 200 && !other.text.includes(mine.code)
		);
		ok('ticket ajeno: sin orders:read -> 404', (await staffAsOtherCashier(mine.code)) === 404);

		const web = await cartWith([['TAZ-CER', 1]]);
		const w = await web.post('/checkout', {
			name: 'Ana Pérez',
			email: 'ana@correo.test',
			phone: '',
			method: 'transfer'
		});
		const loc = parseOrderLocation(w.location);
		ok(
			'un pedido web no se abre como ticket del TPV',
			(await boss.get(`/tpv/ventas/${loc.code}`)).status === 404
		);
		await boss.post(`/admin/ventas/${(await orderByCode(loc.code)).id}?/cancel`, {});
	});
});

/** Un tercer usuario con pos:use pero sin orders:read: se crea un cajero nuevo. */
async function staffAsOtherCashier(code) {
	const { runScript } = await import('./support.js');
	runScript(
		'scripts/create-staff.js',
		['--email', 'caja2@test.local', '--name', 'Caja 2', '--role', 'cajero'],
		{
			STAFF_PASSWORD: 'Caja2-pass-1234'
		}
	);
	const c = client();
	await c.post('/admin/entrar', { email: 'caja2@test.local', password: 'Caja2-pass-1234' });
	return (await c.get(`/tpv/ventas/${code}`)).status;
}
