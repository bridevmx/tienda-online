<script>
	import Money from './Money.svelte';

	/** Tarjeta de producto del listado (ver storefront.toProductCard). */
	let { product, ivaIncluded = false } = $props();
</script>

<a
	href={product.href}
	class="card border border-current/10 transition hover:border-current/30"
	data-testid="product-card"
>
	<figure class="aspect-square overflow-hidden rounded-t-box bg-current/5">
		{#if product.image}
			<img class="size-full object-cover" src={product.image} alt={product.name} loading="lazy" />
		{:else}
			<div
				class="flex size-full items-center justify-center text-4xl opacity-30"
				aria-hidden="true"
			>
				{product.name.slice(0, 1)}
			</div>
		{/if}
	</figure>
	<div class="card-body gap-1 p-4">
		<h3 class="line-clamp-2 font-medium">{product.name}</h3>
		{#if product.from}
			<p class="text-lg font-semibold">
				{#if product.multiplePrices}<span class="text-sm font-normal opacity-60"
						>Desde
					</span>{/if}<Money cents={product.from.card} />
			</p>
			{#if product.from.saves > 0}
				<p class="text-xs opacity-70">
					<Money cents={product.from.other} /> en efectivo o transferencia
				</p>
			{/if}
			{#if ivaIncluded}<p class="text-xs opacity-60">IVA incluido</p>{/if}
		{/if}
		{#if product.availability === 'out'}
			<span class="badge badge-error">Agotado</span>
		{:else if product.availability === 'low'}
			<span class="badge badge-info">Pocas piezas</span>
		{/if}
	</div>
</a>
