import { describe, expect, it } from 'vitest';
import { client, count, enabled, first, ok, pbStaff, staff } from './support.js';
import { createPb } from '#core/pb.js';
import { cfg } from './support.js';

describe.skipIf(!enabled)('ajustes de la tienda', () => {
	it('permisos: solo admin entra a /admin/ajustes', async () => {
		const boss = await staff('boss');
		const ger = await staff('ger');
		const caja = await staff('caja');
		const anon = client();
		ok('anonimo -> login', (await anon.get('/admin/ajustes')).status === 303);
		ok('gerente -> 403', (await ger.get('/admin/ajustes')).status === 403);
		ok('cajero -> 403', (await caja.get('/admin/ajustes')).status === 403);
		const page = await boss.get('/admin/ajustes');
		ok(
			'admin ve la pagina con sus secciones',
			page.status === 200 &&
				page.text.includes('Impuestos') &&
				page.text.includes('Pagos con tarjeta (Clip)') &&
				page.text.includes('Transferencia bancaria')
		);
		ok(
			'trae los valores por defecto',
			page.text.includes('name="tax.iva_rate"') &&
				page.text.includes('value="16"') &&
				page.text.includes('value="2.9"')
		);
		ok(
			'el menu de admin incluye Ajustes y el de gerente no',
			(await boss.get('/admin')).text.includes('href="/admin/ajustes"') &&
				!(await ger.get('/admin')).text.includes('/admin/ajustes')
		);
		ok(
			'el cajero no puede guardar (403)',
			(await caja.post('/admin/ajustes', { 'store.name': 'Hack' })).status === 403
		);
	});

	it('PocketBase: solo quien tiene settings:read los lee y nadie los borra', async () => {
		const anon = createPb(cfg.pbUrl);
		const ger = await pbStaff('ger');
		const boss = await pbStaff('boss');
		const list = async (pb) => (await pb.collection('settings').getList(1, 5)).items.length;
		ok('anonimo no lee ajustes', (await list(anon).catch(() => 0)) === 0);
		ok(
			'gerente no lee ajustes (incluyen la comision de Clip)',
			(await list(ger).catch(() => 0)) === 0
		);
		await expect(boss.collection('settings').getList(1, 5)).resolves.toBeTruthy();
		const any = await boss.collection('settings').getList(1, 1);
		if (any.items[0])
			await expect(boss.collection('settings').delete(any.items[0].id)).rejects.toBeTruthy();
	});

	it('validacion y guardado', async () => {
		const boss = await staff('boss');
		let r = await boss.post('/admin/ajustes', { 'store.name': 'Mi tienda', 'tax.iva_rate': 'abc' });
		ok(
			'porcentaje invalido -> 400 con mensaje en el campo',
			r.status === 400 && r.text.includes('Escribe un porcentaje'),
			r.status
		);
		ok('...y no se guardo nada', (await count('settings', 'key="store.name"')) === 0);

		r = await boss.post('/admin/ajustes', { 'store.name': 'x'.repeat(100) });
		ok('nombre demasiado largo -> 400', r.status === 400);

		r = await boss.post('/admin/ajustes', { 'transfer.clabe': '123' });
		ok('CLABE invalida -> 400', r.status === 400 && r.text.includes('18 dígitos'));

		r = await boss.post('/admin/ajustes', {
			'store.name': 'Mi tienda',
			'tax.apply_iva': 'on',
			'tax.iva_rate': '8',
			'clip.apply_fee': 'on',
			'clip.fee_rate': '3,1',
			'clip.fee_fixed': '2.50',
			// pricing.discount_non_card ausente -> apagado
			'orders.pending_ttl_hours': '48',
			'transfer.beneficiary': 'Mi Tienda SA',
			'transfer.clabe': '012345678901234567'
		});
		ok(
			'guardar -> 200 con aviso',
			r.status === 200 && /Ajustes guardados/.test(r.text),
			`${r.status}`
		);
		const value = async (key) => (await first('settings', `key="${key}"`)).value;
		ok(
			'valores canonicos en la base',
			(await value('store.name')) === 'Mi tienda' &&
				(await value('tax.iva_rate')) === '8' &&
				(await value('clip.fee_rate')) === '3.1' &&
				(await value('clip.fee_fixed')) === '250' &&
				(await value('orders.pending_ttl_hours')) === '48'
		);
		ok(
			'booleanos: encendidos y el ausente apagado',
			(await value('clip.apply_fee')) === 'true' &&
				(await value('pricing.discount_non_card')) === 'false'
		);

		const page = await boss.get('/admin/ajustes');
		ok(
			'la pagina refleja lo guardado (dinero en pesos)',
			page.text.includes('value="Mi tienda"') &&
				page.text.includes('value="3.1"') &&
				page.text.includes('value="2.50"') &&
				page.text.includes('value="012345678901234567"')
		);

		r = await boss.post('/admin/ajustes', {
			'store.name': 'Mi tienda',
			'tax.apply_iva': 'on',
			'tax.iva_rate': '8',
			'clip.apply_fee': 'on',
			'clip.fee_rate': '3.1',
			'clip.fee_fixed': '2.50',
			'orders.pending_ttl_hours': '48',
			'transfer.beneficiary': 'Mi Tienda SA',
			'transfer.clabe': '012345678901234567'
		});
		ok('guardar lo mismo no cambia nada', /No hubo cambios/.test(r.text), r.status);

		// restaura los valores por defecto para no afectar a otras pruebas
		await boss.post('/admin/ajustes', {
			'store.name': 'Tienda online',
			'tax.apply_iva': 'on',
			'tax.iva_rate': '16',
			'clip.apply_fee': 'off',
			'clip.fee_rate': '2.9',
			'clip.fee_fixed': '0',
			'pricing.discount_non_card': 'on',
			'orders.pending_ttl_hours': '24',
			'transfer.beneficiary': '',
			'transfer.clabe': ''
		});
		ok(
			'restaurado',
			(await value('clip.apply_fee')) === 'false' && (await value('tax.iva_rate')) === '16'
		);
	});
});
