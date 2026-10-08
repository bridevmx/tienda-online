<script>
	import ProductCard from '#ui/shop/ProductCard.svelte';
	import { routes } from '#core/routes.js';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.storeName}</title>
	<meta
		name="description"
		content={`Compra en ${data.storeName}: productos con envío y pago seguro.`}
	/>
	<meta property="og:title" content={data.storeName} />
</svelte:head>

<div class="flex flex-col gap-10">
	<section class="rounded-box bg-primary px-6 py-12 text-primary-content sm:px-12">
		<h1 class="text-3xl font-bold sm:text-4xl">{data.storeName}</h1>
		<p class="mt-2 max-w-xl text-lg opacity-90">
			Encuentra lo que buscas, paga como prefieras y sigue tu pedido.
		</p>
		<a class="btn btn-secondary mt-6" href={routes.products()}>Ver productos</a>
	</section>

	{#if data.categories.length}
		<section aria-labelledby="cats">
			<h2 id="cats" class="mb-4 text-xl font-semibold">Categorías</h2>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each data.categories as category (category.id)}
					<li>
						<a
							class="card flex-row items-center gap-3 border border-current/10 p-3 transition hover:border-current/30"
							href={category.href}
						>
							{#if category.image}
								<img
									class="size-14 rounded-field object-cover"
									src={category.image}
									alt=""
									loading="lazy"
								/>
							{:else}
								<span
									class="flex size-14 items-center justify-center rounded-field bg-current/5 text-xl opacity-60"
									aria-hidden="true">{category.name.slice(0, 1)}</span
								>
							{/if}
							<span class="font-medium">{category.name}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="latest">
		<div class="mb-4 flex items-end justify-between">
			<h2 id="latest" class="text-xl font-semibold">Lo más reciente</h2>
			<a class="link" href={routes.products()}>Ver todo</a>
		</div>
		{#if data.latest.length}
			<ul class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
				{#each data.latest as product (product.id)}
					<li><ProductCard {product} ivaIncluded={data.ivaIncluded} /></li>
				{/each}
			</ul>
		{:else}
			<p class="opacity-70">Pronto tendremos productos.</p>
		{/if}
	</section>
</div>
