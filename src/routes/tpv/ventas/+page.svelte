<script>
	import Money from '#ui/shop/Money.svelte';
	import StatusBadge from '#ui/shop/StatusBadge.svelte';
	import { formatDate } from '#core/dates.js';
	import { routes } from '#core/routes.js';
	import { METHOD_LABEL, orderStatusView } from '#modules/sales/status.js';

	let { data } = $props();
	const s = $derived(data.summary);
</script>

<svelte:head><title>Mis ventas | TPV</title></svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4">
	<h1 class="text-2xl font-semibold">Mis ventas de hoy</h1>

	<section class="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen del turno">
		<div class="card border border-current/10">
			<div class="card-body gap-0 p-4">
				<p class="text-sm opacity-70">Total vendido</p>
				<p class="text-xl font-semibold" data-testid="shift-total"><Money cents={s.all.total} /></p>
				<p class="text-xs opacity-60">{s.all.count} venta(s)</p>
			</div>
		</div>
		{#each Object.entries(METHOD_LABEL) as [id, label] (id)}
			<div class="card border border-current/10">
				<div class="card-body gap-0 p-4">
					<p class="text-sm opacity-70">{label}</p>
					<p class="text-xl font-semibold" data-testid="shift-{id}">
						<Money cents={s.byMethod[id]?.total ?? 0} />
					</p>
					<p class="text-xs opacity-60">{s.byMethod[id]?.count ?? 0} venta(s)</p>
				</div>
			</div>
		{/each}
	</section>
	{#if data.pending}
		<div role="status" class="alert alert-info">
			Tienes {data.pending} cobro(s) con tarjeta esperando pago.
		</div>
	{/if}

	{#if !data.orders.length}
		<p class="opacity-70">Todavía no hay ventas hoy.</p>
	{:else}
		<ul class="flex flex-col gap-2" data-testid="shift-orders">
			{#each data.orders as o (o.code)}
				{@const st = orderStatusView(o.status)}
				<li>
					<a
						class="card border border-current/10 hover:border-primary"
						href={routes.pos.sale(o.code)}
					>
						<div class="card-body flex-row flex-wrap items-center gap-3 p-3">
							<span class="font-mono text-sm">{o.code}</span>
							<StatusBadge label={st.label} badge={st.badge} />
							<span class="text-sm opacity-70">{METHOD_LABEL[o.method]}</span>
							<span class="text-sm opacity-60">{formatDate(o.createdAt, { time: true })}</span>
							<strong class="ml-auto"><Money cents={o.total} /></strong>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
