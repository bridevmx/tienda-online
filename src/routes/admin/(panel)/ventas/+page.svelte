<script>
	import { page } from '$app/state';
	import Pagination from '#ui/crud/Pagination.svelte';
	import { withParams } from '#ui/crud/query.js';
	import Money from '#ui/shop/Money.svelte';
	import StatusBadge from '#ui/shop/StatusBadge.svelte';
	import { formatDate } from '#core/dates.js';

	let { data } = $props();
	const f = $derived(data.filters);
	const s = $derived(data.summary);
	const link = (changes) => withParams(page.url, { ...changes, page: null });
</script>

<svelte:head>
	<title>Ventas | Administración</title>
</svelte:head>

<div class="flex flex-col gap-5">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">Ventas</h1>
		<nav class="join" aria-label="Periodo">
			{#each Object.entries(data.ranges) as [key, label] (key)}
				<a
					class="join-item btn btn-sm {f.range === key && !f.from && !f.to ? 'btn-primary' : ''}"
					href={link({ rango: key, desde: null, hasta: null })}>{label}</a
				>
			{/each}
		</nav>
	</div>

	<section aria-label="Resumen" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<div class="card border border-current/10">
			<div class="card-body gap-0 p-4">
				<p class="text-sm opacity-70">Ventas</p>
				<p class="text-2xl font-semibold" data-testid="sum-total"><Money cents={s.all.total} /></p>
				<p class="text-xs opacity-60">{s.all.count} pedido(s) pagados</p>
			</div>
		</div>
		<div class="card border border-current/10">
			<div class="card-body gap-0 p-4">
				<p class="text-sm opacity-70">Tienda web</p>
				<p class="text-2xl font-semibold"><Money cents={s.byChannel.web?.total ?? 0} /></p>
				<p class="text-xs opacity-60">{s.byChannel.web?.count ?? 0} pedido(s)</p>
			</div>
		</div>
		<div class="card border border-current/10">
			<div class="card-body gap-0 p-4">
				<p class="text-sm opacity-70">TPV</p>
				<p class="text-2xl font-semibold"><Money cents={s.byChannel.pos?.total ?? 0} /></p>
				<p class="text-xs opacity-60">{s.byChannel.pos?.count ?? 0} pedido(s)</p>
			</div>
		</div>
		<div class="card border border-current/10">
			<div class="card-body gap-0 p-4">
				<p class="text-sm opacity-70">IVA / Descuentos</p>
				<p class="text-lg font-semibold">
					<Money cents={s.all.tax} /> / <Money cents={s.all.discount} />
				</p>
				<p class="text-xs opacity-60">en el periodo</p>
			</div>
		</div>
	</section>

	{#if Object.keys(s.byMethod).length}
		<ul class="flex flex-wrap gap-2 text-sm" aria-label="Por método de pago">
			{#each Object.entries(s.byMethod) as [method, v] (method)}
				<li class="badge badge-outline badge-lg gap-1">
					{data.methods[method] ?? method}: <Money cents={v.total} />
					<span class="opacity-60">({v.count})</span>
				</li>
			{/each}
		</ul>
	{/if}

	<nav class="tabs tabs-border" aria-label="Estado">
		<a class="tab {f.status === '' ? 'tab-active' : ''}" href={link({ estado: null })}>Todos</a>
		{#each data.statuses as st (st.id)}
			<a class="tab {f.status === st.id ? 'tab-active' : ''}" href={link({ estado: st.id })}
				>{st.label}</a
			>
		{/each}
	</nav>

	<form method="GET" class="flex flex-wrap items-end gap-2">
		<input type="hidden" name="rango" value={f.range} />
		{#if f.status}<input type="hidden" name="estado" value={f.status} />{/if}
		<input
			class="input"
			type="search"
			name="q"
			value={f.q}
			placeholder="Código, nombre o correo…"
			aria-label="Buscar"
		/>
		<select class="select" name="canal" aria-label="Canal">
			<option value="">Canal: todos</option>
			{#each Object.entries(data.channels) as [id, label] (id)}<option
					value={id}
					selected={f.channel === id}>{label}</option
				>{/each}
		</select>
		<select class="select" name="metodo" aria-label="Método de pago">
			<option value="">Pago: todos</option>
			{#each Object.entries(data.methods) as [id, label] (id)}<option
					value={id}
					selected={f.method === id}>{label}</option
				>{/each}
		</select>
		<label class="flex items-center gap-1 text-sm"
			>Desde <input class="input input-sm" type="date" name="desde" value={f.from} /></label
		>
		<label class="flex items-center gap-1 text-sm"
			>Hasta <input class="input input-sm" type="date" name="hasta" value={f.to} /></label
		>
		<button class="btn">Filtrar</button>
	</form>

	<div class="overflow-x-auto rounded-box border border-current/10">
		<table class="table">
			<thead>
				<tr
					><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Estado</th
					><th class="text-end">Total</th></tr
				>
			</thead>
			<tbody>
				{#each data.rows as row (row.id)}
					<tr class="hover:bg-current/5">
						<td
							><a class="link font-mono text-sm" href={row.href} data-testid="order-link"
								>{row.code}</a
							></td
						>
						<td class="text-sm opacity-70">{formatDate(row.createdAt, { time: true })}</td>
						<td>{row.who}</td>
						<td>{row.channel}</td>
						<td>{row.method}</td>
						<td><StatusBadge label={row.status.label} badge={row.status.badge} /></td>
						<td class="text-end"><Money cents={row.total} /></td>
					</tr>
				{:else}
					<tr><td colspan="7" class="py-8 text-center opacity-60">Sin resultados</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="flex items-center justify-between text-sm">
		<span class="opacity-60">{data.pagination.totalItems} pedido(s)</span>
		<Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
	</div>
</div>
