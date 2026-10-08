<script>
	import Pagination from '#ui/crud/Pagination.svelte';
	import ProductCard from './ProductCard.svelte';

	let { result, ivaIncluded = false, empty = 'No encontramos productos.' } = $props();
</script>

{#if result.items.length}
	<ul class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
		{#each result.items as product (product.id)}
			<li><ProductCard {product} {ivaIncluded} /></li>
		{/each}
	</ul>
	<div class="mt-6 flex justify-center">
		<Pagination page={result.page} totalPages={result.totalPages} />
	</div>
{:else}
	<p class="py-12 text-center opacity-70">{empty}</p>
{/if}
