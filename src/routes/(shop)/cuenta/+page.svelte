<script>
	import Money from '#ui/shop/Money.svelte';
	import { routes } from '#core/routes.js';

	let { data } = $props();
	const date = (iso) =>
		new Intl.DateTimeFormat('es-MX', {
			dateStyle: 'medium',
			timeZone: 'America/Mexico_City'
		}).format(new Date(iso));
</script>

<svelte:head>
	<title>Mis pedidos</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1 class="text-2xl font-semibold">Mis pedidos</h1>

{#if !data.orders.length}
	<div class="card border border-current/10">
		<div class="card-body items-start gap-2">
			<p>Aún no tienes pedidos en tu cuenta.</p>
			<a class="btn btn-primary btn-sm" href={routes.products()}>Ver productos</a>
		</div>
	</div>
{:else}
	<ul class="flex flex-col gap-3" data-testid="orders">
		{#each data.orders as order (order.code)}
			<li class="card border border-current/10" data-testid="order-card">
				<div class="card-body gap-2 p-4">
					<div class="flex flex-wrap items-center gap-2">
						<span class="badge {order.statusBadge}">{order.statusLabel}</span>
						<span class="font-mono text-sm">{order.code}</span>
						<span class="ml-auto text-sm opacity-70">{date(order.createdAt)}</span>
					</div>
					<p class="text-sm">
						{order.summary.join(' · ')}{#if order.more}
							<span class="opacity-60"> y {order.more} más</span>{/if}
					</p>
					<div class="flex flex-wrap items-center gap-2">
						<strong><Money cents={order.total} /></strong>
						<span class="text-sm opacity-70">{order.methodLabel}</span>
						<a class="btn btn-sm ml-auto {order.pending ? 'btn-primary' : ''}" href={order.href}
							>{order.pending ? 'Ver y pagar' : 'Ver detalle'}</a
						>
					</div>
				</div>
			</li>
		{/each}
	</ul>
	{#if data.totalPages > 1}
		<div class="join self-center">
			{#each Array.from({ length: data.totalPages }, (_, i) => i + 1) as n (n)}
				<a class="join-item btn btn-sm {n === data.page ? 'btn-active' : ''}" href="?page={n}"
					>{n}</a
				>
			{/each}
		</div>
	{/if}
{/if}
