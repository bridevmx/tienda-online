import { describe, it } from 'vitest';
import { cfg, client, enabled, ok, pbLogin, pbRaw, raw, uid } from './support.js';

describe.skipIf(!enabled)('acceso: sesiones, aislamiento y reglas de PocketBase', () => {
	it('flujos completos', async () => {
		const CLI = `cli-${uid()}@test.local`;
		const su = (await pbLogin('_superusers', cfg.superuser.email, cfg.superuser.password)).token;
		// ---- Web: personal
		let w = client();
		let r = await w.post('/admin/entrar', { email: 'boss@test.local', password: 'mala' });
		ok(
			'contrasena incorrecta -> 400 con mensaje generico',
			r.status === 400 && r.text.includes('Correo o contraseña incorrectos'),
			r.status
		);
		r = await w.post('/admin/entrar', { email: 'no-es-correo', password: 'x' });
		ok(
			'correo invalido -> 400 con error de campo',
			r.status === 400 && r.text.includes('Escribe un correo válido'),
			r.status
		);
		r = await w.post('/admin/entrar?next=//evil.com', {
			email: 'boss@test.local',
			password: 'Admin-pass-123'
		});
		ok(
			'login admin -> 303 a /admin (next externo ignorado)',
			r.status === 303 && r.headers.get('location') === '/admin',
			r.headers.get('location')
		);
		ok(
			'cookie pb_staff httpOnly + SameSite=Lax',
			/HttpOnly/i.test(r.cookiesSet?.pb_staff || '') &&
				/SameSite=Lax/i.test(r.cookiesSet?.pb_staff || ''),
			JSON.stringify(r.cookiesSet)
		);
		r = await w.get('/admin');
		ok('/admin con sesion -> 200', r.status === 200 && r.text.includes('Hola, Jefa'), r.status);
		ok(
			'admin ve permisos de roles y usuarios',
			r.text.includes('roles:update') && r.text.includes('users:delete')
		);
		r = await w.get('/admin/entrar');
		ok(
			'/admin/entrar con sesion redirige a /admin',
			r.status === 303 && r.headers.get('location') === '/admin'
		);
		r = await w.get('/cuenta');
		ok(
			'staff no entra a /cuenta (sesion de cliente aparte)',
			r.status === 303 && r.headers.get('location').startsWith('/entrar')
		);

		// ---- Web: cajero
		const wc = client();
		await wc.post('/admin/entrar?next=/admin', {
			email: 'caja@test.local',
			password: 'Caja-pass-1234'
		});
		r = await wc.get('/admin');
		ok('cajero entra', r.status === 200 && r.text.includes('Cajero'));
		ok(
			'cajero ve solo sus permisos',
			r.text.includes('customers:read') &&
				!r.text.includes('roles:update') &&
				!r.text.includes('users:delete')
		);

		// ---- Cambios en caliente
		// quitar un permiso al rol cajero -> aplica en la siguiente solicitud, sin volver a entrar
		const cajeroRole = (
			await pbRaw(`/api/collections/roles/records?filter=${encodeURIComponent('slug="cajero"')}`, {
				token: su
			})
		).json.items[0];
		const custCreate = (
			await pbRaw(
				`/api/collections/permissions/records?filter=${encodeURIComponent('code="customers:create"')}`,
				{ token: su }
			)
		).json.items[0];
		await pbRaw(`/api/collections/roles/records/${cajeroRole.id}`, {
			token: su,
			method: 'PATCH',
			body: { 'permissions-': [custCreate.id] }
		});
		r = await wc.get('/admin');
		ok(
			'permiso revocado desaparece sin re-login',
			r.status === 200 && !r.text.includes('customers:create') && r.text.includes('customers:read')
		);
		await pbRaw(`/api/collections/roles/records/${cajeroRole.id}`, {
			token: su,
			method: 'PATCH',
			body: { 'permissions+': [custCreate.id] }
		});
		// desactivar usuario
		const cajaUser = (
			await pbRaw(
				`/api/collections/users/records?filter=${encodeURIComponent('email="caja@test.local"')}`,
				{ token: su }
			)
		).json.items[0];
		await pbRaw(`/api/collections/users/records/${cajaUser.id}`, {
			token: su,
			method: 'PATCH',
			body: { active: false }
		});
		r = await wc.get('/admin');
		ok(
			'usuario desactivado pierde la sesion de inmediato',
			r.status === 303 && r.headers.get('location').startsWith('/admin/entrar'),
			r.status
		);
		const wc2 = client();
		r = await wc2.post('/admin/entrar', { email: 'caja@test.local', password: 'Caja-pass-1234' });
		ok('usuario inactivo no puede iniciar sesion', r.status === 400);
		await pbRaw(`/api/collections/users/records/${cajaUser.id}`, {
			token: su,
			method: 'PATCH',
			body: { active: true }
		});

		// ---- Cookies manipuladas
		const wf = client();
		wf.jar.set('pb_staff', 'basura.basura.basura');
		r = await wf.get('/admin');
		ok('token falso -> login y cookie limpiada', r.status === 303 && !wf.jar.has('pb_staff'));
		// token de cliente puesto en la cookie de personal
		await pbRaw('/api/collections/customers/records', {
			method: 'POST',
			body: {
				email: CLI,
				password: 'Cliente-pass-1',
				passwordConfirm: 'Cliente-pass-1',
				name: 'Cli Uno'
			}
		});
		const custAuth = await pbLogin('customers', CLI, 'Cliente-pass-1');
		const wx = client();
		wx.jar.set('pb_staff', custAuth.token);
		r = await wx.get('/admin');
		ok(
			'token de CLIENTE en cookie de personal no da acceso',
			r.status === 303 && r.headers.get('location').startsWith('/admin/entrar'),
			r.status
		);

		// ---- Web: cliente
		const wcl = client();
		r = await wcl.post('/entrar', { email: CLI, password: 'Cliente-pass-1' });
		ok(
			'login cliente -> /cuenta',
			r.status === 303 && r.headers.get('location') === '/cuenta',
			r.headers.get('location')
		);
		r = await wcl.get('/cuenta');
		ok('/cuenta con sesion', r.status === 200 && r.text.includes('Cli Uno'));
		r = await wcl.get('/admin');
		ok(
			'cliente no entra al admin',
			r.status === 303 && r.headers.get('location').startsWith('/admin/entrar')
		);
		await wcl.post('/salir', {});
		r = await wcl.get('/cuenta');
		ok('logout cliente cierra la sesion', r.status === 303);
		await w.post('/admin/salir', {});
		r = await w.get('/admin');
		ok(
			'logout personal cierra la sesion',
			r.status === 303 && r.headers.get('location').startsWith('/admin/entrar')
		);
		r = await raw('/admin/entrar', {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: 'http://evil.example',
				'x-forwarded-proto': 'http'
			},
			body: 'email=a@b.com&password=x'
		});
		ok('CSRF: POST con Origin ajeno -> 403', r.status === 403, r.status);

		// ---------- Reglas de la API de PocketBase (defensa en profundidad)
		// ---- Reglas de PocketBase
		const boss = await pbLogin('users', 'boss@test.local', 'Admin-pass-123');
		const caja = await pbLogin('users', 'caja@test.local', 'Caja-pass-1234');
		const cli = await pbLogin('customers', CLI, 'Cliente-pass-1');
		const items = (x) => x.json?.items ?? [];

		ok(
			'anonimo: no lista permisos/roles/usuarios',
			(
				await Promise.all(
					['permissions', 'roles', 'users'].map((c) => pbRaw(`/api/collections/${c}/records`))
				)
			).every((x) => (x.status === 200 ? items(x).length === 0 : x.status >= 400))
		);
		ok(
			'anonimo: no puede crear personal',
			(
				await pbRaw('/api/collections/users/records', {
					method: 'POST',
					body: { email: 'x@y.com', password: 'abcdefgh1', passwordConfirm: 'abcdefgh1' }
				})
			).status >= 400
		);
		ok(
			'cajero: lista de roles vacia (sin roles:read)',
			items(await pbRaw('/api/collections/roles/records', { token: caja.token })).length === 0
		);
		ok(
			'cajero: puede ver su propio rol',
			(await pbRaw(`/api/collections/roles/records/${caja.record.role}`, { token: caja.token }))
				.status === 200
		);
		const adminRole = (
			await pbRaw(`/api/collections/roles/records?filter=${encodeURIComponent('slug="admin"')}`, {
				token: boss.token
			})
		).json.items[0];
		ok(
			'cajero: no ve el rol admin',
			(await pbRaw(`/api/collections/roles/records/${adminRole.id}`, { token: caja.token }))
				.status === 404
		);
		ok(
			'cajero: users lista solo a si mismo',
			items(await pbRaw('/api/collections/users/records', { token: caja.token })).length === 1
		);
		ok(
			'cajero: edita su nombre',
			(
				await pbRaw(`/api/collections/users/records/${caja.record.id}`, {
					token: caja.token,
					method: 'PATCH',
					body: { name: 'Caja 2' }
				})
			).status === 200
		);
		ok(
			'cajero: NO puede cambiar su rol a admin',
			(
				await pbRaw(`/api/collections/users/records/${caja.record.id}`, {
					token: caja.token,
					method: 'PATCH',
					body: { role: adminRole.id }
				})
			).status >= 400
		);
		ok(
			'cajero: NO puede reactivarse/cambiar active',
			(
				await pbRaw(`/api/collections/users/records/${caja.record.id}`, {
					token: caja.token,
					method: 'PATCH',
					body: { active: true }
				})
			).status >= 400
		);
		ok(
			'cajero: no crea roles',
			(
				await pbRaw('/api/collections/roles/records', {
					token: caja.token,
					method: 'POST',
					body: { name: 'X', slug: 'x' }
				})
			).status >= 400
		);
		ok(
			'cajero: no crea usuarios',
			(
				await pbRaw('/api/collections/users/records', {
					token: caja.token,
					method: 'POST',
					body: { email: 'z@z.com', password: 'abcdefgh1', passwordConfirm: 'abcdefgh1' }
				})
			).status >= 400
		);
		ok(
			'cajero: no escribe permisos',
			(
				await pbRaw('/api/collections/permissions/records', {
					token: caja.token,
					method: 'POST',
					body: { code: 'a:b', module: 'x' }
				})
			).status >= 400
		);
		ok(
			'cajero: lista clientes (customers:read)',
			items(await pbRaw('/api/collections/customers/records', { token: caja.token })).length >= 1
		);
		ok(
			'cajero: no edita clientes (solo gerente)',
			(
				await pbRaw(`/api/collections/customers/records/${cli.record.id}`, {
					token: caja.token,
					method: 'PATCH',
					body: { name: 'Hack' }
				})
			).status >= 400
		);
		ok(
			'cajero: no borra clientes',
			(
				await pbRaw(`/api/collections/customers/records/${cli.record.id}`, {
					token: caja.token,
					method: 'DELETE'
				})
			).status >= 400
		);

		ok(
			'admin: lista todo el personal',
			items(await pbRaw('/api/collections/users/records', { token: boss.token })).length >= 2
		);
		ok(
			'admin: cambia el rol de otro usuario',
			(
				await pbRaw(`/api/collections/users/records/${caja.record.id}`, {
					token: boss.token,
					method: 'PATCH',
					body: { role: caja.record.role }
				})
			).status === 200
		);
		ok(
			'admin: NO puede cambiarse el rol a si mismo',
			(
				await pbRaw(`/api/collections/users/records/${boss.record.id}`, {
					token: boss.token,
					method: 'PATCH',
					body: { role: caja.record.role }
				})
			).status >= 400
		);
		ok(
			'admin: NO puede borrarse a si mismo',
			(
				await pbRaw(`/api/collections/users/records/${boss.record.id}`, {
					token: boss.token,
					method: 'DELETE'
				})
			).status >= 400
		);
		ok(
			'admin: no edita el rol system (admin)',
			(
				await pbRaw(`/api/collections/roles/records/${adminRole.id}`, {
					token: boss.token,
					method: 'PATCH',
					body: { 'permissions-': [custCreate.id] }
				})
			).status >= 400
		);
		ok(
			'admin: no borra el rol system',
			(
				await pbRaw(`/api/collections/roles/records/${adminRole.id}`, {
					token: boss.token,
					method: 'DELETE'
				})
			).status >= 400
		);
		ok(
			'admin: no crea roles con system=true',
			(
				await pbRaw('/api/collections/roles/records', {
					token: boss.token,
					method: 'POST',
					body: { name: 'Falso', slug: 'falso', system: true }
				})
			).status >= 400
		);
		const nr = await pbRaw('/api/collections/roles/records', {
			token: boss.token,
			method: 'POST',
			body: { name: 'Auditor', slug: 'auditor', permissions: [custCreate.id] }
		});
		ok('admin: crea un rol normal', nr.status === 200);
		ok(
			'admin: edita y borra rol normal',
			(
				await pbRaw(`/api/collections/roles/records/${nr.json.id}`, {
					token: boss.token,
					method: 'PATCH',
					body: { name: 'Auditor 2' }
				})
			).status === 200 &&
				(
					await pbRaw(`/api/collections/roles/records/${nr.json.id}`, {
						token: boss.token,
						method: 'DELETE'
					})
				).status === 204
		);
		ok(
			'rol: slug invalido rechazado',
			(
				await pbRaw('/api/collections/roles/records', {
					token: boss.token,
					method: 'POST',
					body: { name: 'Mal', slug: 'Mal Slug' }
				})
			).status >= 400
		);

		ok(
			'cliente: lista clientes -> solo el',
			items(await pbRaw('/api/collections/customers/records', { token: cli.token })).length === 1
		);
		ok(
			'cliente: edita su nombre',
			(
				await pbRaw(`/api/collections/customers/records/${cli.record.id}`, {
					token: cli.token,
					method: 'PATCH',
					body: { name: 'Cli Uno' }
				})
			).status === 200
		);
		const v = await pbRaw(`/api/collections/customers/records/${cli.record.id}`, {
			token: cli.token,
			method: 'PATCH',
			body: { verified: true }
		});
		const after = await pbRaw(`/api/collections/customers/records/${cli.record.id}`, {
			token: cli.token
		});
		ok(
			'cliente: no puede autoverificarse',
			after.json.verified === false,
			`status ${v.status}, verified=${after.json.verified}`
		);
		ok(
			'cliente: no lee users/roles/permissions',
			(
				await Promise.all(
					['users', 'roles', 'permissions'].map((c) =>
						pbRaw(`/api/collections/${c}/records`, { token: cli.token })
					)
				)
			).every((x) => x.status >= 400 || items(x).length === 0)
		);
		ok(
			'personal: no puede actuar como cliente en su propia coleccion',
			(await pbRaw(`/api/collections/customers/records/${cli.record.id}`, { token: caja.token }))
				.status === 200 /* customers:read lo permite */
		);
		ok(
			'cliente no se borra a si mismo',
			(
				await pbRaw(`/api/collections/customers/records/${cli.record.id}`, {
					token: cli.token,
					method: 'DELETE'
				})
			).status >= 400
		);
	});
});
