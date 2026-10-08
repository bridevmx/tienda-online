<script>
	import ProductGrid from '#ui/shop/ProductGrid.svelte';
	import { routes } from '#core/routes.js';

	let { data } = $props();
	const category = $derived(data.result.category);
	const children = $derived(data.categories.find((c) => c.slug === category.slug)?.children ?? []);
</script>

<svelte:head>
	<title>{category.name} | {data.storeName}</title>
	<meta name="description" content={`Compra ${category.name} en ${data.storeName}.`} />
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="breadcrumbs text-sm">
		<ul>
			<li><a href={routes.home()}>Inicio</a></li>
			{#if category.parent}<li>
					<a href={routes.category(category.parent.slug)}>{category.parent.name}</a>
				</li>{/if}
			<li>{category.name}</li>
		</ul>
	</div>
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div>
			<h1 class="text-2xl font-semibold">{category.name}</h1>
			<p class="text-sm opacity-70">{data.result.totalItems} producto(s)</p>
		</div>
		<form method="GET">
			<select
				class="select select-sm"
				name="sort"
				aria-label="Ordenar"
				onchange={(e) => e.currentTarget.form.requestSubmit()}
			>
				<option value="recientes" selected={data.sort === 'recientes'}>Más recientes</option>
				<option value="nombre" selected={data.sort === 'nombre'}>Nombre (A-Z)</option>
			</select>
		</form>
	</div>
	{#if children.length}
		<ul class="flex flex-wrap gap-2">
			{#each children as child (child.id)}
				<li><a class="btn btn-sm btn-outline" href={child.href}>{child.name}</a></li>
			{/each}
		</ul>
	{/if}
	<ProductGrid result={data.result} ivaIncluded={data.ivaIncluded} />
</div>
