import { afterAll, beforeAll, describe, it } from 'vitest';
import {
	PNG,
	cartWith,
	client,
	enabled,
	first,
	ok,
	orderByCode,
	parseOrderLocation,
	saveSettings,
	staff,
	stockOf
} from './support.js';

const contact = { name: 'Beto Ruiz', email: 'beto@correo.test', phone: '' };
const TRANSFER = {
	'transfer.beneficiary': 'Mi Tienda SA',
	'transfer.bank': 'Banco Prueba',
	'transfer.clabe': '012345678901234567'
};

/** Pedido por transferencia como invitado. */
async function transferOrder(items, withProof = false) {
	const b = await cartWith(items);
	const res = await b.post('/checkout', { ...contact, method: 'transfer' });
	const loc = parseOrderLocation(res.location);
	if (!loc) throw new Error(`Checkout fallo: ${res.status} ${res.location}`);
	if (withProof)
		await b.multipart(
			`/pedido/${loc.code}?/proof&t=${encodeURIComponent(loc.token)}`,
			[],
			[{ name: 'proof', filename: 'c.png', type: 'image/png', data: PNG }]
		);
	return { ...loc, order: await orderByCode(loc.code) };
}

describe.skipIf(!enabled)('ventas en el admin', () => {
	let boss, ger, caja;
	beforeAll(async () => {
		[boss, ger, caja] = await Promise.all([staff('boss'), staff('ger'), staff('caja')]);
		await saveSettings(boss, TRANSFER);
	});
	afterAll(async () => {
		await saveSettings(boss);
	});

	it('permisos: gerente ve ventas, cajero no', async () => {
		ok('gerente lista', (await ger.get('/admin/ventas')).status === 200);
		ok('admin lista', (await boss.get('/admin/ventas')).status === 200);
		const c = await caja.get('/admin/ventas');
		ok('cajero 403', c.status === 403, c.status);
		ok('anonimo redirige', (await client().get('/admin/ventas')).status === 303);
	});

	it('lista con filtros y resumen', async () => {
		const { code } = await transferOrder([['TAZ-CER', 1]]);
		let r = await ger.get('/admin/ventas?rango=30d');
		ok('aparece el pedido', r.text.includes(code));
		r = await ger.get(`/admin/ventas?q=${code}`);
		ok('busqueda por codigo', r.text.includes(code));
		r = await ger.get('/admin/ventas?q=NOEXISTE-123');
		ok('busqueda sin resultados', !r.text.includes(code));
		r = await ger.get('/admin/ventas?estado=pending&canal=web&metodo=transfer');
		ok('filtros combinados', r.text.includes(code));
		r = await ger.get('/admin/ventas?estado=completed');
		ok('otro estado no lo incluye', !r.text.includes(code));
		r = await ger.get('/admin/ventas?estado=hack&rango=zzz&page=-4');
		ok('valores invalidos se ignoran', r.status === 200);
	});

	it('confirmar transferencia y completar', async () => {
		const { code, order } = await transferOrder([['TAZ-CER', 1]]);
		const url = `/admin/ventas/${order.id}`;
		let r = await ger.get(url);
		ok(
			'detalle con finanzas',
			r.status === 200 && r.text.includes(code) && r.text.includes('sale-net')
		);
		r = await ger.post(`${url}?/confirm`, {});
		ok('confirmar', r.status === 303);
		let o = await orderByCode(code);
		ok('pedido pagado', o.status === 'paid', o.status);
		ok('pago confirmado', (await first('payments', `order="${order.id}"`)).status === 'confirmed');
		r = await ger.post(`${url}?/confirm`, {});
		ok(
			'confirmar de nuevo no rompe',
			r.status === 303 && (await orderByCode(code)).status === 'paid'
		);
		r = await ger.post(`${url}?/complete`, {});
		o = await orderByCode(code);
		ok('completado', r.status === 303 && o.status === 'completed', o.status);
	});

	it('cancelar repone el stock', async () => {
		const before = await stockOf('TAZ-CER');
		const { code, order } = await transferOrder([['TAZ-CER', 2]]);
		ok('reservado', (await stockOf('TAZ-CER')) === before - 2);
		const r = await ger.post(`/admin/ventas/${order.id}?/cancel`, { reason: 'Prueba' });
		ok('cancelado', r.status === 303 && (await orderByCode(code)).status === 'cancelled');
		ok('stock repuesto', (await stockOf('TAZ-CER')) === before);
	});

	it('reembolsar con y sin reponer stock', async () => {
		for (const restock of [true, false]) {
			const { code, order } = await transferOrder([['TAZ-CER', 1]]);
			const url = `/admin/ventas/${order.id}`;
			await ger.post(`${url}?/confirm`, {});
			const afterPay = await stockOf('TAZ-CER');
			const r = await ger.post(`${url}?/refund`, restock ? { restock: 'on' } : {});
			const o = await orderByCode(code);
			ok(`reembolsado (${restock})`, r.status === 303 && o.status === 'refunded', o.status);
			ok(
				`stock ${restock ? 'repuesto' : 'sin cambio'}`,
				(await stockOf('TAZ-CER')) === afterPay + (restock ? 1 : 0)
			);
		}
	});

	it('el cajero no puede operar ventas', async () => {
		const { code, order } = await transferOrder([['TAZ-CER', 1]]);
		for (const a of ['confirm', 'complete', 'cancel', 'refund']) {
			const r = await caja.post(`/admin/ventas/${order.id}?/${a}`, {});
			ok(`cajero ${a} denegado`, r.status === 403, r.status);
		}
		ok('sigue pendiente', (await orderByCode(code)).status === 'pending');
		await boss.post(`/admin/ventas/${order.id}?/cancel`, {});
	});

	it('detalle: ids invalidos 404 y comprobante privado', async () => {
		ok('id invalido', (await ger.get('/admin/ventas/no-existe')).status === 404);
		const { order } = await transferOrder([['TAZ-CER', 1]], true);
		const proof = `/admin/ventas/${order.id}/comprobante`;
		const r = await ger.get(proof);
		ok('personal ve el comprobante', r.status === 200 && r.buf.length > 0, r.status);
		ok('anonimo no', (await client().get(proof)).status !== 200);
		ok('cajero no', (await caja.get(proof)).status === 403);
		await boss.post(`/admin/ventas/${order.id}?/cancel`, {});
	});
});
