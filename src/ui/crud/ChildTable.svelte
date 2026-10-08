<script>
	import DataTable from './DataTable.svelte';

	/** Registros hijos de un padre (variantes de un producto, valores de una opcion). */
	let { child } = $props();
</script>

<section class="flex flex-col gap-3">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">{child.label}</h2>
		{#if child.canCreate}
			<a class="btn btn-sm btn-secondary" href={child.newHref}>Agregar</a>
		{/if}
	</div>
	<DataTable
		columns={child.resource.columns.filter((c) => c.key !== child.foreignKey)}
		rows={child.rows}
		sortable={false}
	/>
</section>
