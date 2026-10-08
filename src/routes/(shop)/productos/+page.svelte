<script>
	import ProductGrid from '#ui/shop/ProductGrid.svelte';

	let { data } = $props();
	const title = $derived(data.q ? `Resultados para “${data.q}”` : 'Productos');
</script>

<svelte:head>
	<title>{title} | {data.storeName}</title>
	{#if data.q}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div>
			<h1 class="text-2xl font-semibold">{title}</h1>
			<p class="text-sm opacity-70">{data.result.totalItems} producto(s)</p>
		</div>
		<form method="GET" class="flex items-center gap-2">
			{#if data.q}<input type="hidden" name="q" value={data.q} />{/if}
			<select
				class="select select-sm"
				name="sort"
				aria-label="Ordenar"
				onchange={(e) => e.currentTarget.form.requestSubmit()}
			>
				<option value="recientes" selected={data.sort === 'recientes'}>Más recientes</option>
				<option value="nombre" selected={data.sort === 'nombre'}>Nombre (A-Z)</option>
			</select>
			<noscript><button class="btn btn-sm">Ordenar</button></noscript>
		</form>
	</div>
	<ProductGrid
		result={data.result}
		ivaIncluded={data.ivaIncluded}
		empty={data.q ? 'No encontramos productos con esa búsqueda.' : 'Aún no hay productos.'}
	/>
</div>
