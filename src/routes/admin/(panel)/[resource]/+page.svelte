<script>
	import { page } from '$app/state';
	import ConfirmDelete from '#ui/crud/ConfirmDelete.svelte';
	import DataTable from '#ui/crud/DataTable.svelte';
	import Pagination from '#ui/crud/Pagination.svelte';
	import { routes } from '#core/routes.js';

	let { data } = $props();
	const resource = $derived(data.resource);
	let deleting = $state(null);

	const filtering = $derived(
		data.query.q !== '' ||
			Object.keys(data.query.filters).length > 0 ||
			page.url.searchParams.has('sort')
	);
	const boolValue = (name) => {
		const v = data.query.filters[name];
		return v === undefined ? '' : v ? '1' : '0';
	};
</script>

<svelte:head>
	<title>{resource.label[1]} | Administración</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{resource.label[1]}</h1>
		{#if data.canCreate}
			<a class="btn btn-primary" href={routes.admin.create(resource.name)}>
				{resource.feminine ? 'Nueva' : 'Nuevo'}
				{resource.label[0].toLowerCase()}
			</a>
		{/if}
	</div>

	<form method="GET" class="flex flex-wrap items-end gap-2">
		{#if resource.hasSearch}
			<input
				class="input"
				type="search"
				name="q"
				value={data.query.q}
				placeholder="Buscar…"
				aria-label="Buscar"
			/>
		{/if}
		{#each resource.filters as filter (filter.name)}
			<select class="select" name={filter.name} aria-label={filter.label}>
				<option value="">{filter.label}: todos</option>
				{#if filter.type === 'bool'}
					<option value="1" selected={boolValue(filter.name) === '1'}>Sí</option>
					<option value="0" selected={boolValue(filter.name) === '0'}>No</option>
				{:else}
					{#each data.filterOptions[filter.name] ?? [] as option (option.value)}
						<option
							value={option.value}
							selected={data.query.filters[filter.name] === option.value}
						>
							{option.label}
						</option>
					{/each}
				{/if}
			</select>
		{/each}
		{#if data.query.sort && page.url.searchParams.has('sort')}
			<input type="hidden" name="sort" value={data.query.sort} />
		{/if}
		<button class="btn">Buscar</button>
		{#if filtering}
			<a class="btn btn-ghost" href={routes.admin.list(resource.name)}>Limpiar</a>
		{/if}
	</form>

	<DataTable
		columns={resource.columns}
		rows={data.rows}
		sort={data.query.sort}
		onDelete={(row) => (deleting = { id: row.id, title: row.title })}
	/>

	<div class="flex items-center justify-between text-sm">
		<span class="opacity-60">{data.pagination.totalItems} registro(s)</span>
		<Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
	</div>
</div>

{#if data.rows.some((row) => row.canDelete)}
	<ConfirmDelete bind:target={deleting} noun={resource.label[0].toLowerCase()} />
{/if}
