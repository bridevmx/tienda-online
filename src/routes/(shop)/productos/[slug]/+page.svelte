<script>
	import Gallery from '#ui/shop/Gallery.svelte';
	import Money from '#ui/shop/Money.svelte';
	import PriceSimulator from '#ui/shop/PriceSimulator.svelte';
	import VariantPicker from '#ui/shop/VariantPicker.svelte';
	import { routes } from '#core/routes.js';

	let { data } = $props();
	const product = $derived(data.product);
	const variant = $derived(data.variant);
	const images = $derived(product.images);
	const maxQty = $derived(variant ? Math.min(Math.max(variant.stock, 1), 10) : 1);
	const buyable = $derived(!!variant && variant.stock > 0);

	// precios para mostrar: el de la variante elegida o, si falta elegir, el "desde"
	const prices = $derived(variant?.prices ?? null);
	const from = $derived.by(() => {
		const list = product.variants.filter((v) => v.stock > 0);
		const pool = list.length ? list : product.variants;
		return pool.length
			? pool.reduce((a, b) => (b.prices.card < a.prices.card ? b : a)).prices
			: null;
	});
	const shown = $derived(prices ?? from);

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: product.name,
			description: product.summary,
			image: product.images.map((i) => i.src),
			offers: shown && {
				'@type': 'Offer',
				priceCurrency: 'MXN',
				price: (shown.card / 100).toFixed(2),
				availability: product.variants.some((v) => v.stock > 0)
					? 'https://schema.org/InStock'
					: 'https://schema.org/OutOfStock'
			}
		}).replaceAll('<', '\\u003c')
	);
	// se arma por partes: un literal con la etiqueta completa confunde al analizador de Svelte
	const ldScript = $derived(`<scr${'ipt'} type="application/ld+json">${jsonLd}</scr${'ipt'}>`);
</script>

<svelte:head>
	<title>{product.name} | {data.storeName}</title>
	<meta name="description" content={product.summary || `${product.name} en ${data.storeName}`} />
	<link rel="canonical" href={data.canonical} />
	<meta property="og:title" content={product.name} />
	<meta property="og:type" content="product" />
	{#if product.images[0]}<meta property="og:image" content={product.images[0].src} />{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON generado por nosotros y con '<' escapado -->
	{@html ldScript}
</svelte:head>

<div class="flex flex-col gap-8">
	<div class="breadcrumbs text-sm">
		<ul>
			<li><a href={routes.home()}>Inicio</a></li>
			{#if product.parentCategory}<li>
					<a href={product.parentCategory.href}>{product.parentCategory.name}</a>
				</li>{/if}
			{#if product.category}<li>
					<a href={product.category.href}>{product.category.name}</a>
				</li>{/if}
			<li>{product.name}</li>
		</ul>
	</div>

	<div class="grid gap-8 md:grid-cols-2">
		<Gallery {images} name={product.name} />

		<div class="flex flex-col gap-5">
			<h1 class="text-2xl font-semibold sm:text-3xl">{product.name}</h1>

			{#if shown}
				<div data-testid="price">
					<p class="text-3xl font-bold">
						{#if !variant && product.variants.length > 1}<span
								class="text-base font-normal opacity-60"
								>Desde
							</span>{/if}<Money cents={shown.card} />
					</p>
					{#if data.ivaIncluded}<p class="text-sm opacity-60">IVA incluido</p>{/if}
					{#if shown.saves > 0}
						<p class="mt-1 text-sm">
							<strong><Money cents={shown.other} /></strong> pagando en efectivo o transferencia
							<span class="badge badge-secondary badge-sm ml-1"
								>Ahorras <Money cents={shown.saves} /></span
							>
						</p>
					{/if}
				</div>
			{:else}
				<p class="opacity-70">Producto no disponible por el momento.</p>
			{/if}

			{#if data.options.length}<VariantPicker options={data.options} />{/if}

			{#if data.incomplete}
				<p class="text-sm opacity-70" role="status">
					Elige una opción de cada tipo para continuar.
				</p>
			{:else if variant && !buyable}
				<p><span class="badge badge-error">Agotado</span></p>
			{:else if variant && variant.availability === 'low'}
				<p><span class="badge badge-info">Pocas piezas disponibles</span></p>
			{/if}

			<form method="POST" action={`${routes.cart()}?/add`} class="flex flex-wrap items-end gap-3">
				<input type="hidden" name="variant" value={variant?.id ?? ''} />
				<label class="flex flex-col gap-1 text-sm">
					Cantidad
					<select class="select w-24" name="qty" disabled={!buyable} aria-label="Cantidad">
						{#each Array.from({ length: maxQty }, (_, i) => i + 1) as n (n)}<option value={n}
								>{n}</option
							>{/each}
					</select>
				</label>
				<button class="btn btn-primary btn-lg" disabled={!buyable}>Agregar al carrito</button>
			</form>

			{#if product.descriptionHtml}
				<section aria-labelledby="desc">
					<h2 id="desc" class="mb-2 font-semibold">Descripción</h2>
					<div
						class="prose-sm space-y-2 [&_a]:link [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML saneado en el servidor (core/html.js) -->
						{@html product.descriptionHtml}
					</div>
				</section>
			{/if}
		</div>
	</div>

	{#if data.simulator}<PriceSimulator simulator={data.simulator} />{/if}
</div>
