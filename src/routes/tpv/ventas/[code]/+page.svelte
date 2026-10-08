<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import Money from '#ui/shop/Money.svelte';
	import StatusBadge from '#ui/shop/StatusBadge.svelte';
	import { formatDate } from '#core/dates.js';
	import { routes } from '#core/routes.js';

	let { data } = $props();
	const order = $derived(data.order);

	// mientras se espera la tarjeta se consulta el estado cada pocos segundos
	onMount(() => {
		const timer = setInterval(() => data.waiting && invalidateAll(), 3000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>Venta {order.code} | TPV</title></svelte:head>

<div class="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
	{#if data.waiting}
		<section class="card border border-primary text-center print:hidden" aria-live="polite">
			<div class="card-body items-center gap-3">
				<h1 class="card-title">Esperando el pago con tarjeta</h1>
				{#if data.qr}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generado por nosotros con la libreria qrcode a partir del link de Clip -->
					<div class="rounded-box bg-white p-2" data-testid="pos-qr">{@html data.qr}</div>
					<p class="text-sm opacity-70">
						El cliente escanea el código para pagar <Money cents={order.totals.total} />.
					</p>
				{/if}
				<span class="loading loading-dots"></span>
				<form method="POST" action="?/cancel" use:enhance>
					<button class="btn btn-sm">Cancelar cobro</button>
				</form>
			</div>
		</section>
	{:else}
		<div class="flex items-center gap-2 print:hidden">
			<StatusBadge label={order.statusLabel} badge={order.statusBadge} />
			<span class="text-sm opacity-70">Venta registrada</span>
		</div>
	{/if}

	<article class="card border border-current/10 print:border-0" data-testid="ticket">
		<div class="card-body gap-3 p-5 font-mono text-sm">
			<header class="text-center">
				<p class="text-base font-semibold">{order.code}</p>
				<p class="opacity-70">{formatDate(order.createdAt, { time: true })}</p>
				{#if data.cashier}<p class="opacity-70">Atendió: {data.cashier}</p>{/if}
			</header>
			<ul class="flex flex-col gap-1 border-y border-dashed border-current/30 py-2">
				{#each order.items as item, i (i)}
					<li class="flex justify-between gap-2">
						<span>{item.qty} × {item.name}{item.label ? ` (${item.label})` : ''}</span>
						<span><Money cents={item.total} /></span>
					</li>
				{/each}
			</ul>
			<dl class="flex flex-col gap-1">
				<div class="flex justify-between">
					<dt>Subtotal</dt>
					<dd><Money cents={order.totals.subtotal} /></dd>
				</div>
				{#if order.totals.discount > 0}
					<div class="flex justify-between">
						<dt>Descuento por pago en efectivo o transferencia</dt>
						<dd>−<Money cents={order.totals.discount} /></dd>
					</div>
				{/if}
				{#if order.totals.iva > 0}
					<div class="flex justify-between">
						<dt>IVA</dt>
						<dd><Money cents={order.totals.iva} /></dd>
					</div>
				{/if}
				<div class="flex justify-between text-base font-semibold">
					<dt>Total</dt>
					<dd data-testid="ticket-total"><Money cents={order.totals.total} /></dd>
				</div>
				<div class="flex justify-between">
					<dt>Pago</dt>
					<dd>{order.methodLabel}</dd>
				</div>
				{#if data.received !== null}
					<div class="flex justify-between">
						<dt>Recibido</dt>
						<dd><Money cents={data.received} /></dd>
					</div>
					<div class="flex justify-between font-semibold" data-testid="ticket-change">
						<dt>Cambio</dt>
						<dd><Money cents={data.change} /></dd>
					</div>
				{/if}
			</dl>
			<p class="text-center opacity-70">¡Gracias por tu compra!</p>
		</div>
	</article>

	<div class="flex flex-wrap gap-2 print:hidden">
		<a class="btn btn-primary flex-1" href={routes.pos.home()}>Nueva venta</a>
		<button class="btn" onclick={() => window.print()}>Imprimir</button>
		<a class="btn btn-ghost" href={routes.pos.sales()}>Mis ventas</a>
	</div>
</div>
