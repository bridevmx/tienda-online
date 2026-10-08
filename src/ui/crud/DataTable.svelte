<script>
	import { page } from '$app/state';
	import Cell from './Cell.svelte';
	import { withParams } from './query.js';

	/**
	 * Tabla del CRUD. `columns` y `rows` vienen del servidor. Si `onDelete` existe, cada fila con
	 * `canDelete` muestra el boton Eliminar. `sort` activa los encabezados ordenables.
	 */
	let { columns, rows, sort = '', sortable = true, onDelete } = $props();

	const sortHref = (key) =>
		withParams(page.url, { sort: sort === key ? `-${key}` : key, page: null });
	const arrow = (key) => (sort === key ? ' ↑' : sort === `-${key}` ? ' ↓' : '');
	const alignEnd = (col) => ['money', 'integer', 'count'].includes(col.type);
</script>

<div class="overflow-x-auto rounded-box border border-current/10">
	<table class="table">
		<thead>
			<tr>
				{#each columns as col (col.key)}
					<th class:text-end={alignEnd(col)}>
						{#if sortable && col.sortable}
							<a class="link link-hover" href={sortHref(col.key)}>{col.label}{arrow(col.key)}</a>
						{:else}
							{col.label}
						{/if}
					</th>
				{/each}
				<th class="text-end">Acciones</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.id)}
				<tr class="hover:bg-current/5">
					{#each row.cells as cell, i (i)}
						<td class:text-end={cell.align === 'end'}><Cell {cell} /></td>
					{/each}
					<td class="text-end whitespace-nowrap">
						<a class="btn btn-ghost btn-xs" href={row.href}>{row.canEdit ? 'Editar' : 'Ver'}</a>
						{#if onDelete && row.canDelete}
							<button
								type="button"
								class="btn btn-ghost btn-xs text-error"
								onclick={() => onDelete(row)}
							>
								Eliminar
							</button>
						{/if}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan={columns.length + 1} class="py-8 text-center opacity-60">Sin resultados</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
