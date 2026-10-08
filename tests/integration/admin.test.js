import { describe, it } from 'vitest';
import { PNG, client, count, enabled, first, ok, pbAs, raw, su as suPb } from './support.js';

describe.skipIf(!enabled)('admin generico: CRUD, imagenes, variantes y roles', () => {
	it('flujos completos', async () => {
		const su = await suPb();
		const webLogin = async (email, password) => {
			const c = client();
			await c.post('/admin/entrar', { email, password });
			return c;
		};
		const as = (email, password) => pbAs('users', email, password);
		const WEB = '';
		void WEB;
		const boss = await webLogin('boss@test.local', 'Admin-pass-123');
		const ger = await webLogin('ger@test.local', 'Ger-pass-12345');
		const caja = await webLogin('caja@test.local', 'Caja-pass-1234');
		const anon = client();

		console.log('== Acceso y menu ==');
		let r = await anon.get('/admin/categories');
		ok(
			'anonimo -> login',
			r.status === 303 && r.headers.get('location').startsWith('/admin/entrar')
		);
		r = await caja.get('/admin/categories');
		ok('cajero ve el listado (categories:read)', r.status === 200 && r.text.includes('Camisetas'));
		ok(
			'cajero no ve el boton Nuevo ni Eliminar',
			!r.text.includes('/admin/categories/nuevo') && !r.text.includes('>Eliminar<')
		);
		ok('cajero: pagina nuevo -> 403', (await caja.get('/admin/categories/nuevo')).status === 403);
		ok(
			'cajero: POST crear -> 403',
			(await caja.post('/admin/categories/nuevo', { name: 'Hack' })).status === 403
		);
		ok('cajero: roles -> 403', (await caja.get('/admin/roles')).status === 403);
		ok('recurso inexistente -> 404', (await boss.get('/admin/inventado')).status === 404);
		ok(
			'registro inexistente -> 404',
			(await boss.get('/admin/categories/aaaaaaaaaaaaaaa')).status === 404
		);
		r = await ger.get('/admin');
		ok(
			'gerente: menu con catalogo y sin roles',
			r.text.includes('href="/admin/products"') &&
				r.text.includes('href="/admin/variants"') &&
				!r.text.includes('href="/admin/roles"') &&
				!r.text.includes('href="/admin/option_values"')
		);
		ok(
			'admin: menu incluye roles',
			(await boss.get('/admin')).text.includes('href="/admin/roles"')
		);

		// ---- Listado: busqueda, orden, filtros, paginacion
		r = await ger.get('/admin/categories?q=ropa');
		ok(
			'busqueda por texto',
			(r.text.match(/href="\/admin\/categories\/[a-z0-9]{15}"/g) || []).length === 1 &&
				r.text.includes('>Ropa<')
		);
		r = await ger.get('/admin/categories?q=%22%20%7C%7C%201%3D1');
		ok(
			'busqueda con comillas/inyeccion no rompe y no devuelve todo',
			r.status === 200 && r.text.includes('Sin resultados')
		);
		const pos = (t, s) => t.indexOf(s);
		r = await ger.get('/admin/categories?sort=-name');
		ok('orden descendente por nombre', pos(r.text, 'Ropa') < pos(r.text, 'Hogar'));
		ok(
			'orden invalido se ignora (200)',
			(await ger.get('/admin/categories?sort=password')).status === 200
		);
		const hogar = await first('categories', 'slug="hogar"');
		r = await ger.get(`/admin/products?category=${hogar.id}`);
		ok('filtro por categoria', r.text.includes('Taza de cerámica') && !r.text.includes('Gorra'));
		r = await ger.get('/admin/products?active=0');
		ok(
			'filtro por estado (inactivos)',
			r.text.includes('Playera descontinuada') && !r.text.includes('Gorra')
		);
		for (let i = 0; i < 22; i++)
			await su
				.collection('options')
				.create({ name: `Opcion ${String(i).padStart(2, '0')}`, sort: 100 + i });
		r = await ger.get('/admin/options?sort=name');
		ok(
			'paginacion: 20 por pagina y enlace a la 2',
			(r.text.match(/href="\/admin\/options\/[a-z0-9]{15}"/g) || []).length === 20 &&
				r.text.includes('page=2')
		);
		r = await ger.get('/admin/options?page=2&sort=name');
		ok('pagina 2 con el resto', r.text.includes('Talla') || r.text.includes('Opcion 2'));

		// ---- Categorias: crear, validar, editar, eliminar
		r = await ger.post('/admin/categories/nuevo', {
			name: 'Juguetes',
			slug: '',
			sort: '5',
			active: 'on'
		});
		const loc = r.headers.get('location') || '';
		ok(
			'crear -> 303 al editar el nuevo registro con aviso',
			r.status === 303 &&
				/^\/admin\/categories\/[a-z0-9]{15}$/.test(loc) &&
				/creado/i.test(r.flash || ''),
			`${r.status} ${loc} ${r.flash}`
		);
		const juguetes = await first('categories', 'name="Juguetes"');
		ok(
			'slug generado desde el nombre y datos guardados',
			juguetes.slug === 'juguetes' && juguetes.sort === 5 && juguetes.active === true
		);
		r = await ger.post('/admin/categories/nuevo', { name: '' });
		ok(
			'nombre vacio -> 400 con error en el campo',
			r.status === 400 && r.text.includes('Escribe un nombre'),
			r.status
		);
		r = await ger.post('/admin/categories/nuevo', { name: 'Otra', slug: 'juguetes' });
		ok(
			'slug duplicado -> 400 "Ya existe"',
			r.status === 400 && r.text.includes('Ya existe un registro'),
			r.status
		);
		r = await ger.post('/admin/categories/nuevo', { name: 'Sin check' });
		ok(
			'checkbox sin marcar -> inactiva (no usa el default)',
			r.status === 303 && (await first('categories', 'name="Sin check"')).active === false
		);
		const camis = await first('categories', 'slug="camisetas"');
		r = await ger.post('/admin/categories/nuevo', {
			name: 'Nieta',
			parent: camis.id,
			active: 'on'
		});
		ok(
			'subcategoria de subcategoria -> 400 (un nivel)',
			r.status === 400 && r.text.includes('un nivel'),
			r.status
		);
		r = await ger.post(`/admin/categories/${juguetes.id}?/save`, {
			name: 'Juguetes y más',
			slug: 'juguetes',
			sort: '7',
			active: 'on'
		});
		ok(
			'editar guarda y vuelve a la misma pagina',
			r.status === 303 &&
				(await first('categories', `id="${juguetes.id}"`)).name === 'Juguetes y más'
		);
		r = await ger.get(`/admin/categories/${juguetes.id}`);
		ok(
			'el formulario de edicion trae los valores',
			r.text.includes('value="Juguetes y más"') && r.text.includes('value="7"')
		);
		ok(
			'la categoria no se ofrece como su propio padre',
			!new RegExp(`<option value="${juguetes.id}"`).test(r.text)
		);
		const ropa = await first('categories', 'slug="ropa"');
		r = await ger.post(`/admin/categories/${ropa.id}?/delete`, { id: ropa.id });
		ok(
			'eliminar categoria con subcategorias -> bloqueado con aviso de error',
			r.status === 303 &&
				/No se puede eliminar/.test(r.flash || '') &&
				(await count('categories', `id="${ropa.id}"`)) === 1,
			r.flash
		);
		r = await caja.post(`/admin/categories?/delete`, { id: juguetes.id });
		ok(
			'cajero no elimina (403)',
			r.status === 403 && (await count('categories', `id="${juguetes.id}"`)) === 1
		);
		r = await ger.post(`/admin/categories?/delete`, { id: juguetes.id });
		ok(
			'gerente elimina una categoria vacia',
			r.status === 303 &&
				/eliminado/i.test(r.flash || '') &&
				(await count('categories', `id="${juguetes.id}"`)) === 0,
			r.flash
		);
		r = await ger.post(`/admin/categories?/delete`, { id: 'no-es-un-id' });
		ok('eliminar con id invalido -> 400', r.status === 400);

		// ---- Escapado (XSS)
		await ger.post('/admin/categories/nuevo', {
			name: '<script>alert(1)</script>',
			slug: 'xss',
			active: 'on'
		});
		r = await ger.get('/admin/categories');
		ok(
			'el nombre se escapa en el listado',
			!r.text.includes('<script>alert(1)</script>') &&
				r.text.includes('&lt;script>alert(1)&lt;/script>')
		);
		const xss = await first('categories', 'slug="xss"');
		r = await ger.get(`/admin/categories/${xss.id}`);
		ok('el nombre se escapa en el formulario', !r.text.includes('<script>alert(1)</script>'));
		await su.collection('categories').delete(xss.id);

		// ---- Productos con imagenes
		const accesorios = await first('categories', 'slug="accesorios"');
		r = await ger.multipart(
			'/admin/products/nuevo',
			[
				['name', 'Sombrero'],
				['slug', ''],
				['category', accesorios.id],
				['description', '<p>Hola</p>'],
				['active', 'on']
			],
			[{ name: 'images', filename: 'sombrero.png', type: 'image/png', data: PNG }]
		);
		const sombrero = await first('products', 'slug="sombrero"').catch(() => null);
		ok(
			'crear producto con imagen -> 303 y archivo guardado',
			r.status === 303 && sombrero && sombrero.images.length === 1,
			`${r.status} ${r.text.slice(0, 200)}`
		);
		r = await ger.get(`/admin/products/${sombrero.id}`);
		ok(
			'el formulario muestra la miniatura via /media (no PocketBase)',
			r.text.includes(`/media/products/${sombrero.id}/`) && !r.text.includes('8090')
		);
		const file = sombrero.images[0];
		let m = await raw(`/media/products/${sombrero.id}/${file}?thumb=160x160`, {
			headers: { 'x-forwarded-proto': 'http' }
		});
		ok(
			'/media sirve la miniatura con cache largo',
			m.status === 200 &&
				m.headers.get('content-type') === 'image/png' &&
				/immutable/.test(m.headers.get('cache-control')),
			`${m.status} ${m.headers.get('content-type')}`
		);
		m = await raw(`/media/products/${sombrero.id}/${file}`, {
			headers: { 'x-forwarded-proto': 'http' }
		});
		ok('/media sirve el original', m.status === 200 && m.buf.length === PNG.length);
		for (const [label, p] of [
			['coleccion no permitida', `/media/users/${sombrero.id}/${file}`],
			['miniatura no configurada', `/media/products/${sombrero.id}/${file}?thumb=9999x9999`],
			['archivo inexistente', `/media/products/${sombrero.id}/nope.png`],
			['id invalido', `/media/products/..%2F..%2Fetc/${file}`],
			['nombre con ..', `/media/products/${sombrero.id}/..%2Fx.png`]
		]) {
			ok(
				`/media rechaza: ${label}`,
				(await raw(p, { headers: { 'x-forwarded-proto': 'http' } })).status === 404
			);
		}
		r = await ger.multipart(
			'/admin/products/nuevo',
			[
				['name', 'Malo'],
				['category', accesorios.id],
				['active', 'on']
			],
			[
				{
					name: 'images',
					filename: 'x.png',
					type: 'text/plain',
					data: Buffer.from('esto no es una imagen')
				}
			]
		);
		ok(
			'archivo que no es imagen -> 400 y no deja el producto a medias',
			r.status === 400 && (await count('products', 'slug="malo"')) === 0,
			`${r.status}`
		);
		r = await ger.multipart(
			`/admin/products/${sombrero.id}?/save`,
			[
				['name', 'Sombrero'],
				['slug', 'sombrero'],
				['category', accesorios.id],
				['active', 'on']
			],
			[{ name: 'images', filename: 'otra.png', type: 'image/png', data: PNG }]
		);
		ok(
			'agregar una segunda imagen conserva la primera',
			r.status === 303 && (await su.collection('products').getOne(sombrero.id)).images.length === 2
		);
		r = await ger.multipart(`/admin/products/${sombrero.id}?/save`, [
			['name', 'Sombrero'],
			['slug', 'sombrero'],
			['category', accesorios.id],
			['active', 'on'],
			['remove_images', file]
		]);
		const left = (await su.collection('products').getOne(sombrero.id)).images;
		ok('quitar una imagen', r.status === 303 && left.length === 1 && !left.includes(file));
		r = await ger.multipart(`/admin/products/${sombrero.id}?/save`, [
			['name', 'Sombrero'],
			['slug', 'sombrero'],
			['category', accesorios.id],
			['active', 'on'],
			['remove_images', '../../etc/passwd']
		]);
		ok(
			'nombres de archivo a quitar sospechosos se ignoran',
			r.status === 303 && (await su.collection('products').getOne(sombrero.id)).images.length === 1
		);
		r = await ger.multipart(
			'/admin/categories/nuevo',
			[
				['name', 'Con foto'],
				['active', 'on']
			],
			[{ name: 'image', filename: 'c.png', type: 'image/png', data: PNG }]
		);
		const conFoto = await first('categories', 'name="Con foto"');
		ok('categoria con imagen unica', r.status === 303 && !!conFoto.image);
		r = await ger.multipart(
			`/admin/categories/${conFoto.id}?/save`,
			[
				['name', 'Con foto'],
				['slug', 'con-foto'],
				['active', 'on']
			],
			[{ name: 'image', filename: 'd.png', type: 'image/png', data: PNG }]
		);
		const cf2 = await su.collection('categories').getOne(conFoto.id);
		ok(
			'subir otra imagen reemplaza la de un campo de un solo archivo',
			r.status === 303 && cf2.image && cf2.image !== conFoto.image
		);

		// ---- Variantes
		r = await ger.get(`/admin/products/${sombrero.id}`);
		ok(
			'el producto muestra su tabla de variantes con Agregar',
			r.text.includes('Variantes') &&
				r.text.includes(`/admin/variants/nuevo?product=${sombrero.id}`)
		);
		const next = `/admin/products/${sombrero.id}`;
		r = await ger.get(
			`/admin/variants/nuevo?product=${sombrero.id}&next=${encodeURIComponent(next)}`
		);
		ok(
			'nueva variante: producto preseleccionado y selects por opcion',
			new RegExp(`<option value="${sombrero.id}"[^>]*selected`).test(r.text) &&
				r.text.includes('Talla') &&
				r.text.includes('Color')
		);
		const talla = await first('options', 'name="Talla"');
		const V = async (o, v) => (await first('option_values', `option="${o.id}" && value="${v}"`)).id;
		const [S, M] = [await V(talla, 'S'), await V(talla, 'M')];
		const form = (extra) => [
			['product', sombrero.id],
			['sku', 'som-001'],
			['barcode', ''],
			['price', '349.90'],
			['stock', '4'],
			['active', 'on'],
			...extra
		];
		const send = (
			extra,
			url = `/admin/variants/nuevo?product=${sombrero.id}&next=${encodeURIComponent(next)}`
		) => ger.multipart(url, form(extra));
		r = await send([
			['values', ''],
			['values', '']
		]);
		ok(
			'crear variante sin opciones: dinero en pesos -> centavos, SKU en mayusculas, vuelve al producto',
			r.status === 303 && r.headers.get('location') === next,
			`${r.status} ${r.text.slice(0, 200)}`
		);
		const v1 = await first('variants', 'sku="SOM-001"');
		ok(
			'price guardado en centavos (34990) y stock 4',
			v1.price === 34990 && v1.stock === 4 && v1.active === true,
			JSON.stringify(v1)
		);
		r = await send([
			['sku', 'SOM-002'],
			['values', S]
		]);
		ok(
			'variante con opciones distintas a las demas del producto -> 400',
			r.status === 400 && r.text.includes('mismas opciones'),
			`${r.status}`
		);
		r = await ger.multipart(
			`/admin/variants/nuevo?product=${(await first('products', 'slug="camiseta-basica"')).id}`,
			[
				['product', (await first('products', 'slug="camiseta-basica"')).id],
				['sku', 'CAM-DUP'],
				['price', '10'],
				['stock', '1'],
				['active', 'on'],
				['values', S],
				['values', M]
			]
		);
		ok(
			'dos valores de la misma opcion -> 400',
			r.status === 400 && r.text.includes('misma opción'),
			`${r.status}`
		);
		r = await ger.multipart(`/admin/variants/nuevo?product=${sombrero.id}`, [
			['product', sombrero.id],
			['sku', 'SOM-004'],
			['price', 'abc'],
			['stock', '1']
		]);
		ok(
			'precio no numerico -> 400 con error en el campo',
			r.status === 400 && r.text.includes('Escribe un número'),
			`${r.status}`
		);
		r = await ger.multipart(`/admin/variants/nuevo?product=${sombrero.id}`, [
			['product', sombrero.id],
			['sku', 'SOM-001'],
			['price', '1'],
			['stock', '1']
		]);
		ok(
			'SKU duplicado -> 400 (campo sku)',
			r.status === 400 && r.text.includes('Ya existe un registro')
		);
		r = await ger.get('/admin/variants?product=' + sombrero.id);
		ok(
			'listado de variantes: precio formateado y filtrado por producto',
			r.text.includes('349.90') && !r.text.includes('CAM-NEG-S')
		);
		r = await ger.get('/admin/variants?q=CAM-BLA-L');
		ok('stock 0 se muestra como Agotado', r.text.includes('Agotado'));
		r = await ger.get('/admin/variants?q=sombrero');
		ok('busqueda por nombre del producto relacionado', r.text.includes('SOM-001'));
		r = await ger.get(`/admin/variants/${v1.id}`);
		ok(
			'editar variante: dinero se muestra en pesos y el producto no se puede cambiar',
			(r.text.includes('value="349.90"') &&
				/<select[^>]*name="product"[^>]*disabled/.test(r.text.replace(/\s+/g, ' '))) ||
				/disabled[^>]*name="product"/.test(r.text.replace(/\s+/g, ' ')),
			r.text.match(/<select[^>]*product[^>]*>/)?.[0]
		);
		const otro = await first('products', 'slug="gorra"');
		r = await ger.multipart(`/admin/variants/${v1.id}?/save`, [
			['product', otro.id],
			['sku', 'SOM-001'],
			['price', '400'],
			['stock', '9'],
			['active', 'on']
		]);
		const v1b = await su.collection('variants').getOne(v1.id);
		ok(
			'intentar mover la variante a otro producto se ignora',
			r.status === 303 && v1b.product === sombrero.id && v1b.price === 40000 && v1b.stock === 9,
			JSON.stringify(v1b)
		);

		// ---- Opciones y valores
		r = await ger.get(`/admin/options/${talla.id}`);
		ok(
			'la opcion lista sus valores',
			r.text.includes('Valores') &&
				r.text.includes('>M<') &&
				r.text.includes(`/admin/option_values/nuevo?option=${talla.id}`)
		);
		r = await ger.multipart(
			`/admin/option_values/nuevo?option=${talla.id}&next=/admin/options/${talla.id}`,
			[
				['option', talla.id],
				['value', 'XL'],
				['sort', '3']
			]
		);
		ok(
			'agregar valor y volver a la opcion',
			r.status === 303 &&
				r.headers.get('location') === `/admin/options/${talla.id}` &&
				(await count('option_values', `option="${talla.id}" && value="XL"`)) === 1
		);
		r = await ger.post('/admin/option_values?/delete', { id: M });
		ok(
			'valor usado por una variante no se elimina',
			r.status === 303 &&
				/No se puede eliminar/.test(r.flash || '') &&
				(await count('option_values', `id="${M}"`)) === 1
		);
		const xl = await first('option_values', `option="${talla.id}" && value="XL"`);
		r = await ger.post('/admin/option_values?/delete', { id: xl.id });
		ok(
			'valor sin uso se elimina',
			r.status === 303 && (await count('option_values', `id="${xl.id}"`)) === 0
		);
		r = await ger.post(`/admin/options?/delete`, { id: talla.id });
		ok(
			'opcion con valores no se elimina',
			/No se puede eliminar/.test(r.flash || '') &&
				(await count('options', `id="${talla.id}"`)) === 1
		);

		// ---- Producto: eliminar arrastra variantes
		r = await ger.post(`/admin/products/${sombrero.id}?/delete`, { id: sombrero.id });
		ok(
			'eliminar producto -> sus variantes tambien',
			r.status === 303 &&
				r.headers.get('location') === '/admin/products' &&
				(await count('variants', `product="${sombrero.id}"`)) === 0 &&
				(await count('products', `id="${sombrero.id}"`)) === 0,
			r.headers.get('location')
		);

		// ---- Roles
		r = await boss.get('/admin/roles');
		ok(
			'listado de roles con tipo Sistema y conteo de permisos',
			r.text.includes('Administrador') && r.text.includes('Sistema') && r.text.includes('Gerente')
		);
		const adminRole = await first('roles', 'slug="admin"');
		r = await boss.get(`/admin/roles/${adminRole.id}`);
		ok(
			'el rol admin es solo lectura y sin boton eliminar',
			r.text.includes('Solo lectura') && !/>\s*Eliminar rol\s*</.test(r.text)
		);
		r = await boss.post(`/admin/roles/${adminRole.id}?/save`, { name: 'Hack', permissions: [] });
		ok('editar el rol system -> 403', r.status === 403);
		r = await boss.post(`/admin/roles?/delete`, { id: adminRole.id });
		ok('eliminar el rol system -> 403', r.status === 403);
		r = await boss.get('/admin/roles/nuevo');
		ok(
			'el formulario de rol agrupa los permisos por modulo',
			r.text.includes('Catálogo') && r.text.includes('Acceso') && r.text.includes('products:update')
		);
		const pRead = await first('permissions', 'code="products:read"'),
			cRead = await first('permissions', 'code="categories:read"'),
			rUpd = await first('permissions', 'code="roles:update"'),
			rRead = await first('permissions', 'code="roles:read"');
		r = await boss.multipart('/admin/roles/nuevo', [
			['name', 'Auditor'],
			['slug', ''],
			['permissions', pRead.id],
			['permissions', cRead.id]
		]);
		const aud = await first('roles', 'slug="auditor"');
		ok(
			'crear rol con permisos marcados',
			r.status === 303 && aud.permissions.length === 2 && aud.system === false
		);
		r = await boss.multipart(`/admin/roles/${aud.id}?/save`, [
			['name', 'Auditor'],
			['slug', 'auditor'],
			['permissions', pRead.id]
		]);
		ok(
			'editar permisos del rol (quitar uno)',
			r.status === 303 && (await su.collection('roles').getOne(aud.id)).permissions.length === 1
		);
		await boss.multipart(`/admin/roles/${aud.id}?/save`, [
			['name', 'Auditor'],
			['slug', 'auditor']
		]);
		ok(
			'desmarcar todos los permisos deja el rol sin permisos',
			(await su.collection('roles').getOne(aud.id)).permissions.length === 0
		);
		r = await boss.post('/admin/roles?/delete', { id: aud.id });
		ok('eliminar rol normal', r.status === 303 && (await count('roles', `id="${aud.id}"`)) === 0);
		// escalada: alguien con roles:update no puede editar SU propio rol (regla de PocketBase)
		const editor = await su
			.collection('roles')
			.create({ name: 'Editor roles', slug: 'editor-roles', permissions: [rUpd.id, rRead.id] });
		const victim = await su
			.collection('roles')
			.create({ name: 'Victima', slug: 'victima', permissions: [] });
		await su.collection('users').create({
			email: 'edit@test.local',
			password: 'Edit-pass-12345',
			passwordConfirm: 'Edit-pass-12345',
			name: 'Ed',
			role: editor.id,
			active: true
		});
		const edPb = await as('edit@test.local', 'Edit-pass-12345');
		let st = 200;
		try {
			await edPb
				.collection('roles')
				.update(editor.id, { permissions: [rUpd.id, rRead.id, pRead.id] });
		} catch (e) {
			st = e.status;
		}
		ok('quien tiene roles:update no puede editar su propio rol (PocketBase)', st >= 400, st);
		st = 200;
		try {
			await edPb.collection('roles').update(victim.id, { permissions: [pRead.id] });
		} catch (e) {
			st = e.status;
		}
		ok('...pero si puede editar otros roles', st === 200, st);
		const ed = await webLogin('edit@test.local', 'Edit-pass-12345');
		r = await ed.post(`/admin/roles/${editor.id}?/save`, {
			name: 'Editor roles',
			slug: 'editor-roles',
			permissions: []
		});
		ok(
			'desde la app tampoco: editar el propio rol falla',
			r.status !== 303 || (await su.collection('roles').getOne(editor.id)).permissions.length === 2,
			r.status
		);
		// ---- CSRF
		r = await raw('/admin/categories/nuevo', {
			method: 'POST',
			headers: {
				origin: 'http://evil.example',
				'x-forwarded-proto': 'http',
				'content-type': 'application/x-www-form-urlencoded',
				cookie: [...ger.jar].map(([k, v]) => `${k}=${v}`).join('; ')
			},
			body: 'name=Hack'
		});
		ok('POST con Origin ajeno -> 403', r.status === 403);
	});
});
