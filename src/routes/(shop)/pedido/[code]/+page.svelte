<script>
	import { enhance } from '$app/forms';
	import Money from '#ui/shop/Money.svelte';
	import { formatDate } from '#core/dates.js';
	import { routes } from '#core/routes.js';

	let { data, form } = $props();
	const order = $derived(data.order);
	const suffix = $derived(data.token ? `&t=${encodeURIComponent(data.token)}` : '');
	const BADGES = {
		primary: 'badge-primary',
		secondary: 'badge-secondary',
		info: 'badge-info',
		error: 'badge-error'
	};
	const waitingForCard = $derived(
		order.status === 'pending' && order.method === 'card_clip' && !data.paymentError
	);
	let confirmCancel = $state(false);
</script>

<svelte:head>
	<title>Pedido {order.code} | {data.storeName}</title>
	<meta name="robots" content="noindex" />
	{#if waitingForCard && order.payment?.payUrl === null}<meta
			http-equiv="refresh"
			content="8"
		/>{/if}
</svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<p class="text-sm opacity-70">Pedido</p>
			<h1 class="text-2xl font-semibold" data-testid="order-code">{order.code}</h1>
			<p class="text-sm opacity-70">{formatDate(order.createdAt, { time: true })}</p>
		</div>
		<span class="badge badge-lg {BADGES[order.statusBadge]}" data-testid="order-status"
			>{order.statusLabel}</span
		>
	</div>

	{#if form?.error}<div role="alert" class="alert alert-error">{form.error}</div>{/if}
	{#if data.paymentError}
		<div role="alert" class="alert alert-error">
			No se completó el pago con tarjeta. Puedes intentarlo de nuevo o elegir otra forma de pago.
		</div>
	{/if}

	{#if order.status === 'pending'}
		<section class="card border border-current/10" aria-labelledby="pay">
			<div class="card-body gap-3">
				<h2 id="pay" class="card-title">Completa tu pago</h2>

				{#if order.transfer}
					<p>
						Haz una transferencia por <strong><Money cents={order.totals.total} /></strong> con estos
						datos y usa tu número de pedido como referencia:
					</p>
					<dl
						class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-box border border-current/10 p-4 text-sm"
					>
						{#if order.transfer.beneficiary}<dt class="opacity-60">Beneficiario</dt>
							<dd>{order.transfer.beneficiary}</dd>{/if}
						{#if order.transfer.bank}<dt class="opacity-60">Banco</dt>
							<dd>{order.transfer.bank}</dd>{/if}
						<dt class="opacity-60">CLABE</dt>
						<dd class="font-mono" data-testid="clabe">{order.transfer.clabe}</dd>
						<dt class="opacity-60">Referencia</dt>
						<dd class="font-mono">{order.transfer.reference}</dd>
						<dt class="opacity-60">Monto</dt>
						<dd><Money cents={order.totals.total} /></dd>
					</dl>
					{#if order.transfer.instructions}<p class="text-sm">{order.transfer.instructions}</p>{/if}

					<form
						method="POST"
						action={`?/proof${suffix}`}
						enctype="multipart/form-data"
						use:enhance
						class="flex flex-wrap items-end gap-3"
					>
						<label class="flex flex-col gap-1 text-sm">
							{order.payment?.hasProof
								? 'Reemplazar comprobante'
								: 'Sube tu comprobante (opcional)'}
							<input
								class="file-input"
								type="file"
								name="proof"
								accept="image/jpeg,image/png,image/webp,application/pdf"
							/>
						</label>
						<button class="btn btn-secondary">Enviar comprobante</button>
					</form>
					{#if order.payment?.hasProof}<p class="text-sm" data-testid="proof-received">
							Ya recibimos un comprobante. Confirmaremos tu pago en cuanto lo revisemos.
						</p>{/if}
				{:else if order.method === 'card_clip'}
					{#if order.payment?.payUrl}
						<p>Tu pedido está reservado. Paga con tu tarjeta en una página segura.</p>
						<a class="btn btn-primary" href={order.payment.payUrl}
							>Pagar <Money cents={order.totals.total} /></a
						>
					{:else}
						<p role="status">Estamos confirmando tu pago. Esta página se actualiza sola.</p>
					{/if}
				{/if}

				{#if order.expiresAt}<p class="text-sm opacity-70">
						Tienes hasta el {formatDate(order.expiresAt, { time: true })} para pagar; después liberamos
						tus productos.
					</p>{/if}
			</div>
		</section>

		<section class="flex flex-wrap items-center gap-3" aria-label="Opciones del pedido">
			{#each data.methods as m (m.id)}
				<form method="POST" action={`?/change${suffix}`} use:enhance>
					<input type="hidden" name="method" value={m.id} />
					<button class="btn btn-outline btn-sm">{m.label}</button>
				</form>
			{/each}
			{#if !confirmCancel}
				<button
					type="button"
					class="btn btn-ghost btn-sm text-error"
					onclick={() => (confirmCancel = true)}>Cancelar pedido</button
				>
			{:else}
				<form
					method="POST"
					action={`?/cancel${suffix}`}
					use:enhance
					class="flex items-center gap-2"
				>
					<span class="text-sm">¿Cancelar este pedido?</span>
					<button class="btn btn-error btn-sm">Sí, cancelar</button>
					<button type="button" class="btn btn-ghost btn-sm" onclick={() => (confirmCancel = false)}
						>No</button
					>
				</form>
			{/if}
		</section>
	{:else if order.status === 'paid' || order.status === 'completed'}
		<div role="status" class="alert alert-info">
			<span>¡Gracias por tu compra! Registramos tu pago.</span>
		</div>
	{:else if order.status === 'cancelled'}
		<div role="status" class="alert alert-error"><span>Este pedido fue cancelado.</span></div>
	{:else if order.status === 'refunded'}
		<div role="status" class="alert alert-info"><span>Este pedido fue reembolsado.</span></div>
	{/if}

	<section class="card border border-current/10" aria-labelledby="items">
		<div class="card-body gap-3">
			<h2 id="items" class="card-title">Tu pedido</h2>
			<ul class="flex flex-col divide-y divide-current/10">
				{#each order.items as item, i (i)}
					<li class="flex justify-between gap-3 py-2">
						<span
							>{item.qty} × {item.name}{#if item.label}
								<span class="opacity-60">({item.label})</span>{/if}</span
						>
						<Money cents={item.total} />
					</li>
				{/each}
			</ul>
			<dl class="flex flex-col gap-1 border-t border-current/10 pt-3 text-sm">
				<div class="flex justify-between">
					<dt>Subtotal</dt>
					<dd><Money cents={order.totals.subtotal} /></dd>
				</div>
				{#if order.totals.discount > 0}
					<div class="flex justify-between">
						<dt>Descuento</dt>
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
					<dt>Total ({order.methodLabel.toLowerCase()})</dt>
					<dd><Money cents={order.totals.total} /></dd>
				</div>
			</dl>
		</div>
	</section>

	<p class="text-sm opacity-70">
		Guarda este enlace para consultar tu pedido. <a class="link" href={routes.products()}
			>Seguir comprando</a
		>
	</p>
</div>
