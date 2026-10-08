<script>
	import { page as current } from '$app/state';
	import { withParams } from './query.js';

	let { page, totalPages } = $props();

	const href = (n) => withParams(current.url, { page: n });

	// ventana de 5 paginas alrededor de la actual
	const pages = $derived.by(() => {
		const start = Math.max(1, Math.min(page - 2, totalPages - 4));
		const end = Math.min(totalPages, start + 4);
		return Array.from({ length: end - start + 1 }, (_, i) => start + i);
	});
</script>

{#if totalPages > 1}
	<nav class="join" aria-label="Paginación">
		<a class="join-item btn btn-sm" class:btn-disabled={page <= 1} href={href(page - 1)}>«</a>
		{#each pages as n (n)}
			<a class="join-item btn btn-sm" class:btn-active={n === page} href={href(n)}>{n}</a>
		{/each}
		<a class="join-item btn btn-sm" class:btn-disabled={page >= totalPages} href={href(page + 1)}
			>»</a
		>
	</nav>
{/if}
