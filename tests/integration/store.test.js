import { afterAll, describe, expect, it } from 'vitest';
import { computeTotals } from '#core/pricing.js';
import { formatMoney } from '#core/money.js';
import {
	client,
	enabled,
	first,
	ok,
	raw,
	saveSettings,
	staff,
	stockOf,
	su as suPb
} from './support.js';

const PRICING = {
	applyIva: true,
	ivaBp: 1600,
	applyFee: false,
	feeBp: 290,
	feeFixed: 0,
	discountNonCard: true
};
const NBSP = new RegExp(String.fromCharCode(160), 'g');
const m = (cents) => formatMoney(cents).replace(NBSP, ' ');
const text = (r) => r.text.replace(NBSP, ' ');
/** Texto visible: sin etiquetas y con espacios normalizados. */
const plain = (r) =>
	text(r)
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ');
const cards = (r) => (r.text.match(/data-testid="product-card"/g) || []).length;

describe.skipIf(!enabled)('tienda publica: catalogo, precios y carrito', () => {
	let boss;
	afterAll(async () => {
		boss ??= await staff('boss');
		await saveSettings(boss); // deja los ajustes por defecto
	});

	it('portada, listado, busqueda y categorias', async () => {
		boss = await staff('boss');
		await saveSettings(boss);
		const anon = client();

		let r = await anon.get('/');
		ok(
			'portada 200 con nombre, categorias y productos',
			r.status === 200 &&
				r.text.includes('Tienda online') &&
				r.text.includes('Ropa') &&
				r.text.includes('Accesorios') &&
				cards(r) >= 5
		);
		ok('no muestra productos inactivos', !r.text.includes('Playera descontinuada'));
		ok('el menu trae el carrito con 0', /Carrito[\s\S]{0,200}badge[^>]*>0</.test(r.text));

		r = await anon.get('/productos');
		ok(
			'listado con todos los activos',
			r.status === 200 &&
				cards(r) >= 5 &&
				r.text.includes('Gorra') &&
				r.text.includes('Taza de cerámica')
		);
		r = await anon.get('/productos?q=taza');
		ok('busqueda por nombre', cards(r) === 1 && r.text.includes('Taza de cerámica'));
		r = await anon.get('/productos?q=zzzz-no-existe');
		ok('busqueda sin resultados', r.text.includes('No encontramos productos con esa búsqueda'));
		r = await anon.get('/productos?q=%3Cscript%3Ealert(1)%3C/script%3E');
		ok(
			'la busqueda se escapa (XSS)',
			!r.text.includes('<script>alert(1)</script>') && r.status === 200
		);
		r = await anon.get('/productos?q=%22%20%7C%7C%201%3D1%20%7C%7C%20%22');
		ok('busqueda con comillas no devuelve todo', r.status === 200 && cards(r) === 0);
		r = await anon.get('/productos?page=abc&sort=hack');
		ok('parametros invalidos se normalizan', r.status === 200 && cards(r) >= 5);
		const byName = await anon.get('/productos?sort=nombre');
		const names = [...byName.text.matchAll(/<h3 class="line-clamp-2 font-medium">([^<]*)</g)].map(
			(x) => x[1]
		);
		ok(
			'orden por nombre',
			names.length >= 5 && names.join('|') === [...names].sort().join('|'),
			names.join('|')
		);

		r = await anon.get('/categorias/ropa');
		ok(
			'categoria padre incluye productos de sus subcategorias',
			r.status === 200 &&
				r.text.includes('Camiseta básica') &&
				r.text.includes('Pantalón de mezclilla') &&
				!r.text.includes('Gorra')
		);
		ok(
			'...y enlaces a sus subcategorias',
			r.text.includes('/categorias/camisetas') && r.text.includes('/categorias/pantalones')
		);
		r = await anon.get('/categorias/camisetas');
		ok(
			'subcategoria: breadcrumb con el padre y solo sus productos',
			r.text.includes('/categorias/ropa') && cards(r) === 1
		);
		ok('categoria inexistente -> 404', (await anon.get('/categorias/no-existe')).status === 404);
		const s = await suPb();
		const hidden = await s
			.collection('categories')
			.create({ name: 'Oculta', slug: 'oculta', active: false });
		ok('categoria inactiva -> 404', (await anon.get('/categorias/oculta')).status === 404);
		await s.collection('categories').delete(hidden.id);
	});

	it('pagina de producto: precio, variantes y SEO', async () => {
		const anon = client();
		let r = await anon.get('/productos/gorra');
		const gorraPrice = computeTotals({ baseCents: 19_900, method: 'card_clip', config: PRICING })
			.customerView.total; // $230.84
		ok(
			'precio con IVA incluido',
			r.status === 200 && text(r).includes(m(gorraPrice)) && r.text.includes('IVA incluido'),
			m(gorraPrice)
		);
		ok('sin comision integrada no hay descuento por metodo', !r.text.includes('Ahorras'));
		ok(
			'SEO: titulo, canonical, og y JSON-LD con MXN',
			r.text.includes('<title>Gorra | Tienda online</title>') &&
				r.text.includes('rel="canonical" href="/productos/gorra"') &&
				r.text.includes('og:title') &&
				r.text.includes('"priceCurrency":"MXN"') &&
				r.text.includes('"price":"230.84"')
		);
		ok(
			'chips de la opcion Color',
			r.text.includes('Color') && r.text.includes('Negro') && r.text.includes('Azul')
		);

		r = await anon.get('/productos/camiseta-basica');
		ok(
			'camiseta: dos opciones y seleccion por defecto (S + Negro)',
			r.text.includes('Talla') && r.text.includes('Color') && /aria-current="true"/.test(r.text)
		);
		const s = await suPb();
		const opt = async (name, value) =>
			(await first('option_values', `option.name="${name}" && value="${value}"`)).id;
		void s;
		const [L, Blanco, S] = [
			await opt('Talla', 'L'),
			await opt('Color', 'Blanco'),
			await opt('Talla', 'S')
		];
		r = await anon.get(`/productos/camiseta-basica?v=${L}&v=${Blanco}`);
		ok(
			'combinacion agotada: aviso y boton deshabilitado',
			r.text.includes('Agotado') && /<button[^>]*disabled[^>]*>\s*Agregar al carrito/.test(r.text),
			r.text.slice(
				r.text.indexOf('Agregar al carrito') - 200,
				r.text.indexOf('Agregar al carrito') + 20
			)
		);
		r = await anon.get(`/productos/camiseta-basica?v=${S}`);
		ok('seleccion incompleta: pide elegir', r.text.includes('Elige una opción de cada tipo'));
		r = await anon.get('/productos/camiseta-basica?v=zzzzzzzzzzzzzzz&v=%3Cscript%3E');
		ok(
			'ids invalidos en la URL se ignoran (queda la seleccion por defecto)',
			r.status === 200 && /aria-current="true"/.test(r.text) && !r.text.includes('zzzzzzzzzzzzzzz')
		);

		ok(
			'producto inactivo -> 404',
			(await anon.get('/productos/playera-descontinuada')).status === 404
		);
		ok('producto inexistente -> 404', (await anon.get('/productos/no-existe')).status === 404);

		// descripcion con HTML peligroso: se sanea
		const gorra = await first('products', 'slug="gorra"');
		const original = gorra.description;
		await (await suPb()).collection('products').update(gorra.id, {
			description:
				'<p>Hola <strong>mundo</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>'
		});
		r = await anon.get('/productos/gorra');
		ok(
			'la descripcion se sanea (conserva <p>, quita script e img)',
			r.text.includes('<p>Hola <strong>mundo</strong></p>') &&
				!r.text.includes('onerror') &&
				!/<script>alert/.test(r.text)
		);
		await (await suPb()).collection('products').update(gorra.id, { description: original });
	});

	it('comision integrada: el cliente ve el descuento por metodo, nunca la comision', async () => {
		await saveSettings(boss, { 'clip.apply_fee': 'on' });
		const anon = client();
		const config = { ...PRICING, applyFee: true };
		const card = computeTotals({ baseCents: 19_900, method: 'card_clip', config }).customerView
			.total;
		const other = computeTotals({ baseCents: 19_900, method: 'transfer', config }).customerView
			.total;
		const r = await anon.get('/productos/gorra');
		ok('precio de lista con la comision dentro', text(r).includes(m(card)), m(card));
		ok(
			'muestra el precio en efectivo o transferencia y cuanto se ahorra',
			text(r).includes(m(other)) &&
				text(r).includes('efectivo o transferencia') &&
				plain(r).includes(`Ahorras ${m(card - other)}`)
		);
		ok('el listado tambien', text(await anon.get('/productos?q=gorra')).includes(m(card)));
		for (const path of [
			'/',
			'/productos',
			'/productos/gorra',
			'/categorias/accesorios',
			'/productos/camiseta-basica'
		]) {
			const page = await anon.get(path);
			ok(
				`sin rastro de la comision en ${path}`,
				!/comisi/i.test(page.text) &&
					!/clipFee|clip_fee|unitBase|baseTotal|"internal"|"net"/.test(page.text) &&
					!/Clip/.test(page.text),
				path
			);
		}
		await saveSettings(boss);
	});

	it('simulador para el personal: comision, IVA y neto', async () => {
		await saveSettings(boss, { 'clip.apply_fee': 'on' });
		const anon = client();
		ok(
			'un cliente no ve el simulador',
			!(await anon.get('/productos/gorra')).text.includes('Simulador')
		);
		const ger = await staff('ger');
		let r = await ger.get('/productos/gorra');
		ok(
			'el gerente si lo ve, con sus interruptores',
			r.text.includes('Simulador de precio') &&
				r.text.includes('solo personal') &&
				r.text.includes('name="iva"') &&
				r.text.includes('name="clip"')
		);
		const gorraBlack = await first('variants', 'sku="GOR-NEG"');
		const base = gorraBlack.price;
		const cfg = { ...PRICING, applyFee: true };
		const card = computeTotals({ baseCents: base, method: 'card_clip', config: cfg });
		ok(
			'muestra lo que paga el cliente, la comision y lo que te queda',
			text(r).includes(m(card.customerView.total)) &&
				text(r).includes(m(card.internal.clipFee)) &&
				text(r).includes(m(card.internal.net)) &&
				text(r).includes(m(base))
		);
		ok(
			'el neto de tarjeta es el precio guardado (±1 centavo)',
			Math.abs(card.internal.net - base) <= 1
		);
		// interruptores: sin IVA y sin comision -> el precio tal cual
		r = await ger.get('/productos/gorra?iva=0&clip=0');
		const plain = computeTotals({
			baseCents: base,
			method: 'card_clip',
			config: { ...PRICING, applyIva: false, applyFee: false }
		});
		ok(
			'con los interruptores apagados el cliente pagaria solo el precio',
			text(r).includes(m(plain.customerView.total)) && text(r).includes('name="iva"')
		);
		// el cajero tambien (products:read); y la pagina publica sigue igual para el cliente
		ok(
			'el cajero tambien lo ve',
			(await (await staff('caja')).get('/productos/gorra')).text.includes('Simulador de precio')
		);
		ok(
			'el precio publico no cambia con los parametros iva/clip',
			!text(await anon.get('/productos/gorra?iva=0&clip=0')).includes('Simulador') &&
				text(await anon.get('/productos/gorra?iva=0&clip=0')).includes(
					m(computeTotals({ baseCents: base, method: 'card_clip', config: cfg }).customerView.total)
				)
		);
		await saveSettings(boss);
	});

	it('carrito: agregar, cambiar, quitar y validaciones', async () => {
		const anon = client();
		const taza = await first('variants', 'sku="TAZ-CER"');
		const gorraNeg = await first('variants', 'sku="GOR-NEG"');
		const cart = (r) => text(r);

		let r = await anon.get('/carrito');
		ok('carrito vacio', r.text.includes('Tu carrito está vacío'));

		r = await anon.post('/carrito?/add', { variant: taza.id, qty: '2' });
		ok(
			'agregar -> 303 al carrito con aviso y cookie httpOnly',
			r.status === 303 &&
				r.location === '/carrito' &&
				/Agregado/.test(r.flash || '') &&
				/HttpOnly/i.test(r.cookiesSet.cart || ''),
			`${r.status} ${r.location}`
		);
		r = await anon.get('/carrito');
		const unit = computeTotals({
			baseCents: 14_900,
			method: 'card_clip',
			config: PRICING
		}).customerView;
		const two = computeTotals({
			baseCents: 29_800,
			method: 'card_clip',
			config: PRICING
		}).customerView;
		ok(
			'linea con nombre, cantidad y total correcto',
			cart(r).includes('Taza de cerámica') &&
				cart(r).includes(m(two.total)) &&
				r.text.includes('(2)'),
			m(two.total)
		);
		ok('el encabezado cuenta las piezas', /badge[^>]*>2</.test(r.text));
		ok('IVA desglosado', cart(r).includes('IVA') && cart(r).includes(m(two.iva)));
		void unit;

		await anon.post('/carrito?/add', { variant: taza.id, qty: '1' });
		ok('agregar la misma variante suma', (await anon.get('/carrito')).text.includes('(3)'));
		await anon.post('/carrito?/set', { variant: taza.id, qty: '5' });
		ok('cambiar cantidad', (await anon.get('/carrito')).text.includes('(5)'));
		const available = await stockOf('TAZ-CER'); // otras pruebas consumen existencias
		r = await anon.post('/carrito?/set', { variant: taza.id, qty: '9999' });
		ok(
			'la cantidad se limita a las existencias con aviso',
			r.flash?.includes(`Solo hay ${available}`) &&
				(await anon.get('/carrito')).text.includes(`(${available})`),
			r.flash
		);
		await anon.post('/carrito?/add', { variant: gorraNeg.id, qty: '1' });
		ok(
			'dos lineas',
			((await anon.get('/carrito')).text.match(/data-testid="cart-line"/g) || []).length === 2
		);
		await anon.post('/carrito?/remove', { variant: taza.id });
		ok(
			'quitar una linea',
			((await anon.get('/carrito')).text.match(/data-testid="cart-line"/g) || []).length === 1
		);
		await anon.post('/carrito?/clear', {});
		ok('vaciar', (await anon.get('/carrito')).text.includes('Tu carrito está vacío'));

		const agotada = await first('variants', 'sku="CAM-BLA-L"');
		r = await anon.post('/carrito?/add', { variant: agotada.id, qty: '1' });
		ok(
			'no se agrega un producto agotado',
			/agotado/i.test(r.flash || '') &&
				(await anon.get('/carrito')).text.includes('Tu carrito está vacío')
		);
		const inactive = await first('variants', 'sku="DESC-001"');
		r = await anon.post('/carrito?/add', { variant: inactive.id, qty: '1' });
		ok('no se agrega un producto inactivo', /ya no está disponible/.test(r.flash || ''));
		r = await anon.post('/carrito?/add', { variant: 'no-es-un-id', qty: '1' });
		ok('id invalido rechazado con aviso', /ya no está disponible/.test(r.flash || ''));
		r = await anon.post('/carrito?/add', { variant: taza.id, qty: '-5' });
		ok(
			'cantidad negativa se trata como 1',
			r.status === 303 && (await anon.get('/carrito')).text.includes('(1)')
		);

		// cookie manipulada
		const evil = client();
		evil.jar.set('cart', 'esto-no-es-json');
		ok(
			'cookie corrupta -> carrito vacio',
			(await evil.get('/carrito')).text.includes('Tu carrito está vacío')
		);
		evil.jar.set(
			'cart',
			encodeURIComponent(
				JSON.stringify([
					{ v: 'zzzzzzzzzzzzzzz', q: 1 },
					{ v: taza.id, q: 99 }
				])
			)
		);
		r = await evil.get('/carrito');
		ok(
			'variante inexistente y cantidad sobre el stock: avisos y pago bloqueado',
			r.text.includes('ya no está disponible') &&
				r.text.includes('Resuelve los avisos') &&
				/<button[^>]*disabled[^>]*>\s*Continuar con la compra/.test(r.text)
		);
		const forged = await raw('/carrito?/add', {
			method: 'POST',
			headers: {
				origin: 'http://evil.example',
				'x-forwarded-proto': 'http',
				'content-type': 'application/x-www-form-urlencoded'
			},
			body: `variant=${taza.id}&qty=1`
		});
		ok('CSRF: agregar con Origin ajeno -> 403', forged.status === 403);
	});

	it('carrito con comision integrada: la cuenta cuadra y se ofrece el ahorro', async () => {
		await saveSettings(boss, { 'clip.apply_fee': 'on' });
		const anon = client();
		const rows = [
			['GOR-NEG', 2],
			['PAN-M', 1],
			['MOC-URB', 1]
		];
		let base = 0;
		for (const [sku, qty] of rows) {
			const v = await first('variants', `sku="${sku}"`);
			await anon.post('/carrito?/add', { variant: v.id, qty: String(qty) });
			base += v.price * qty;
		}
		const config = { ...PRICING, applyFee: true };
		const card = computeTotals({ baseCents: base, method: 'card_clip', config }).customerView;
		const other = computeTotals({ baseCents: base, method: 'transfer', config }).customerView;
		const r = await anon.get('/carrito');
		ok(
			'total de lista (con comision dentro) = computeTotals',
			text(r).includes(m(card.total)) && text(r).includes(m(card.iva))
		);
		ok(
			'ofrece el ahorro por efectivo o transferencia',
			plain(r).includes(`ahorras ${m(card.total - other.total)}`)
		);
		ok(
			'las lineas (IVA incluido) suman el total',
			(() => {
				const amounts = [
					...text(r).matchAll(
						/data-testid="cart-line"[\s\S]*?<strong[^>]*>[\s\S]*?<span class="tabular-nums">([^<]*)</g
					)
				].map((x) => x[1]);
				const cents = amounts.map((a) => Math.round(parseFloat(a.replace(/[^0-9.]/g, '')) * 100));
				return cents.length === 3 && cents.reduce((a, b) => a + b, 0) === card.total;
			})()
		);
		ok(
			'el carrito no filtra la comision',
			!/comisi/i.test(r.text) && !/clipFee|unitBase|baseTotal/.test(r.text)
		);
		await saveSettings(boss);
	});

	it('sitemap y robots', async () => {
		const anon = client();
		let r = await anon.get('/sitemap.xml');
		ok(
			'sitemap con productos y categorias activos',
			r.status === 200 &&
				r.headers.get('content-type').includes('xml') &&
				r.text.includes('/productos/gorra') &&
				r.text.includes('/categorias/ropa') &&
				!r.text.includes('playera-descontinuada')
		);
		r = await anon.get('/robots.txt');
		ok(
			'robots bloquea zonas privadas',
			r.text.includes('Disallow: /admin') && r.text.includes('Disallow: /tpv')
		);
		expect(true).toBe(true);
	});
});
