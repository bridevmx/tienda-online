import { describe, expect, it } from 'vitest';
import {
	cartWith,
	cfg,
	client,
	enabled,
	first,
	inbox,
	ok,
	orderByCode,
	parseOrderLocation,
	pbRaw,
	saveSettings,
	staff,
	uid
} from './support.js';

const PASS = 'Clave-segura-1';
const newEmail = () => `cli-${uid()}@correo.test`;

async function register(email = newEmail(), extra = {}) {
	const c = client();
	const res = await c.post('/registro', {
		name: 'Clara Díaz',
		email,
		phone: '',
		password: PASS,
		passwordConfirm: PASS,
		...extra
	});
	return { c, res, email };
}

async function verify(c, email) {
	const link = inbox.link(await inbox.last(email));
	expect(link, 'correo de verificacion').toMatch(/^\/verificar\//);
	return c.get(link);
}

describe.skipIf(!enabled)('cuenta del cliente', () => {
	it('registro: crea cuenta, inicia sesion y envia verificacion', async () => {
		const bad = await client().post('/registro', {
			name: 'X',
			email: 'no',
			password: '1',
			passwordConfirm: '2'
		});
		ok(
			'errores de validacion',
			bad.status === 400 && bad.text.includes('Escribe un correo válido')
		);

		const { c, res, email } = await register();
		ok(
			'303 a /cuenta',
			res.status === 303 && res.location === '/cuenta',
			`${res.status} ${res.location}`
		);
		ok(
			'cookie httpOnly de sesion',
			/pb_customer=.*HttpOnly/i.test(res.cookiesSet.pb_customer ?? '')
		);
		const page = await c.get('/cuenta');
		ok(
			'cuenta con aviso de verificacion',
			page.status === 200 &&
				page.text.includes('Verifica tu correo') &&
				page.text.includes('Aún no tienes pedidos')
		);
		ok('llego el correo con enlace a la tienda', !!inbox.link(await inbox.last(email)));

		const dup = await register(email);
		ok('correo repetido', dup.res.status === 400 && dup.res.text.includes('Ya existe una cuenta'));
	});

	it('seguridad: no se puede marcar verificado ni leer lo ajeno por la API', async () => {
		const email = newEmail();
		const r = await pbRaw('/api/collections/customers/records', {
			method: 'POST',
			body: { email, name: 'Hack', password: PASS, passwordConfirm: PASS, verified: true }
		});
		const rec = r.json;
		ok(
			'verified se ignora o se rechaza',
			r.status >= 400 || rec.verified !== true,
			JSON.stringify(rec)
		);
		const anon = await pbRaw('/api/collections/orders/records');
		ok('anonimo no lista pedidos', anon.json?.totalItems === 0 || anon.status >= 400);
	});

	it('verificar correo vincula pedidos de invitado y se ven en tarjetas', async () => {
		const boss = await staff('boss');
		await saveSettings(boss, { 'transfer.clabe': '012345678901234567' });
		const email = newEmail();

		// pedido como invitado con ese correo, antes de tener cuenta
		const guest = await cartWith([['TAZ-CER', 1]]);
		const g = await guest.post('/checkout', {
			name: 'Clara Díaz',
			email,
			phone: '',
			method: 'transfer'
		});
		const loc = parseOrderLocation(g.location);
		ok('pedido de invitado', !!loc);
		ok('sin cuenta', !(await orderByCode(loc.code)).customer);

		const { c } = await register(email);
		let r = await c.get('/cuenta');
		ok(
			'sin verificar NO se vincula (no se puede robar pedidos con un correo ajeno)',
			!r.text.includes(loc.code)
		);

		r = await verify(c, email);
		ok(
			'verificar redirige a /cuenta',
			r.status === 303 && r.location === '/cuenta',
			`${r.status} ${r.location}`
		);
		r = await c.get('/cuenta');
		ok(
			'el pedido aparece en una tarjeta',
			r.text.includes(loc.code) && r.text.includes('order-card')
		);
		ok(
			'estatus y accion de pago',
			r.text.includes('Pendiente de pago') && r.text.includes('Ver y pagar')
		);
		ok('sin aviso de verificacion', !r.text.includes('Verifica tu correo'));
		ok('el pedido queda ligado a la cuenta', !!(await orderByCode(loc.code)).customer);
		ok('no se filtran tokens ni finanzas', !/access_token|fee_total|net_total/.test(r.text));

		r = await c.get(`/pedido/${loc.code}`);
		ok('el dueño abre su pedido sin token', r.status === 200 && r.text.includes(loc.code));
		const other = (await register()).c;
		ok('otra cuenta no lo ve', (await other.get(`/pedido/${loc.code}`)).status === 404);

		// un pedido hecho con sesion se liga directo
		const buyer = await cartWith([['TAZ-CER', 1]], c);
		const co = await buyer.post('/checkout', {
			name: 'Clara Díaz',
			email,
			phone: '',
			method: 'transfer'
		});
		const loc2 = parseOrderLocation(co.location);
		ok(
			'pedido con sesion ligado',
			(await orderByCode(loc2.code)).customer === (await first('customers', `email="${email}"`)).id
		);
		await saveSettings(boss);
	});

	it('verificar con enlace invalido avisa sin romper', async () => {
		const c = client();
		const r = await c.get('/verificar/token-falso');
		ok('redirige con aviso', r.status === 303 && /no es válido/.test(r.flash ?? ''), r.flash);
	});

	it('recuperar contraseña: misma respuesta, enlace, nueva clave y sesiones cerradas', async () => {
		const { c, email } = await register();
		await inbox.clear();

		const known = await client().post('/recuperar', { email });
		const unknown = await client().post('/recuperar', { email: newEmail() });
		ok(
			'misma respuesta exista o no el correo',
			known.text.includes('Si ese correo') && unknown.text.includes('Si ese correo')
		);

		const link = inbox.link(await inbox.last(email));
		ok('correo con enlace /recuperar', /^\/recuperar\//.test(link ?? ''));
		const form = await client().get(link);
		ok('formulario', form.status === 200 && form.text.includes('nueva contraseña'));

		let r = await client().post(link, { password: 'abc', passwordConfirm: 'abc' });
		ok('contraseña corta rechazada', r.status === 400);
		r = await client().post(link, {
			password: 'Nueva-clave-99',
			passwordConfirm: 'Nueva-clave-99'
		});
		ok(
			'cambio ok -> /entrar',
			r.status === 303 && r.location === '/entrar',
			`${r.status} ${r.location}`
		);
		r = await client().post(link, { password: 'Otra-clave-99', passwordConfirm: 'Otra-clave-99' });
		ok('el enlace no se reutiliza', r.status === 400 && r.text.includes('no es válido'));

		ok('la sesion anterior ya no sirve', (await c.get('/cuenta')).status === 303);
		const login = client();
		ok(
			'la clave vieja no entra',
			(await login.post('/entrar', { email, password: PASS })).status === 400
		);
		ok(
			'la nueva si',
			(await login.post('/entrar', { email, password: 'Nueva-clave-99' })).status === 303
		);
	});

	it('perfil: datos, contraseña y cambio de correo', async () => {
		const { c, email } = await register();
		let r = await c.post('/cuenta/perfil?/profile', { name: 'Clara D.', phone: '55 1111 2222' });
		ok('guarda perfil', r.status === 303);
		ok('se ve actualizado', (await c.get('/cuenta/perfil')).text.includes('Clara D.'));
		r = await c.post('/cuenta/perfil?/profile', { name: '', phone: '' });
		ok('nombre vacio rechazado', r.status === 400);

		r = await c.post('/cuenta/perfil?/password', {
			oldPassword: 'mala',
			password: 'Otra-clave-77',
			passwordConfirm: 'Otra-clave-77'
		});
		ok(
			'clave actual incorrecta',
			r.status === 400 && r.text.includes('Contraseña actual incorrecta')
		);
		r = await c.post('/cuenta/perfil?/password', {
			oldPassword: PASS,
			password: 'Otra-clave-77',
			passwordConfirm: 'Otra-clave-77'
		});
		ok(
			'cambio de clave mantiene la sesion',
			r.status === 303 && (await c.get('/cuenta')).status === 200
		);

		const next = newEmail();
		await inbox.clear();
		r = await c.post('/cuenta/perfil?/email', { email: next });
		ok('pide cambio de correo', r.status === 303);
		const link = inbox.link(await inbox.last(next));
		ok('correo al nuevo address', /^\/correo\//.test(link ?? ''));
		r = await client().post(link, { password: 'mala' });
		ok('exige la contraseña', r.status === 400);
		r = await client().post(link, { password: 'Otra-clave-77' });
		ok('confirma', r.status === 303);
		ok(
			'entra con el nuevo correo',
			(await client().post('/entrar', { email: next, password: 'Otra-clave-77' })).status === 303
		);
		ok(
			'el viejo ya no',
			(await client().post('/entrar', { email, password: 'Otra-clave-77' })).status === 400
		);
	});

	it('/cuenta exige sesion y conserva a donde iba', async () => {
		const r = await client().get('/cuenta/perfil');
		ok(
			'redirige a entrar con next',
			r.status === 303 && r.location.startsWith('/entrar?next='),
			r.location
		);
	});

	it('limite de intentos fallidos de acceso', async () => {
		const email = newEmail();
		const c = client();
		let last;
		for (let i = 0; i < 10; i++) last = await c.post('/entrar', { email, password: 'mala' });
		ok('tras varios fallos responde 429', last.status === 429, last.status);
		const staffTry = client();
		let s;
		for (let i = 0; i < 10; i++)
			s = await staffTry.post('/admin/entrar', { email: 'x@y.test', password: 'mala' });
		ok('igual en el acceso del personal', s.status === 429, s.status);
		void cfg;
	});
});
