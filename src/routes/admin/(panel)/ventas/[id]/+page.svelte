<script>
	import { enhance } from '$app/forms';
	import Money from '#ui/shop/Money.svelte';
	import StatusBadge from '#ui/shop/StatusBadge.svelte';
	import { formatDate } from '#core/dates.js';
	import { routes } from '#core/routes.js';

	let { data } = $props();
	const order = $derived(data.order);
	let asking = $state(null); // 'cancel' | 'refund' mientras se pide confirmacion
</script>

<svelte:head>
	<title>{order.code} | Ventas</title>
</svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-5">
	<div class="breadcrumbs text-sm">
		<ul>
			<li><a href={routes.admin.home()}>Administración</a></li>
			<li><a href={routes.admin.sales()}>Ventas</a></li>
			<li>{order.code}</li>
		</ul>
	</div>

	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="font-mono text-2xl font-semibold" data-testid="sale-code">{order.code}</h1>
			<StatusBadge label={order.status.label} badge={order.status.badge} />
			<span class="badge badge-outline">{order.channel}</span>
			<span class="badge badge-outline">{order.method}</span>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if data.canConfirm}
				<form method="POST" action="?/confirm" use:enhance>
					<button class="btn btn-primary btn-sm">Confirmar pago</button>
				</form>
			{/if}
			{#if data.canComplete}
				<form method="POST" action="?/complete" use:enhance>
					<button class="btn btn-secondary btn-sm">Marcar completado</button>
				</form>
			{/if}
			{#if data.canCancel}<button
					type="button"
					class="btn btn-outline btn-error btn-sm"
					onclick={() => (asking = 'cancel')}>Cancelar pedido</button
				>{/if}
			{#if data.canRefund}<button
					type="button"
					class="btn btn-outline btn-error btn-sm"
					onclick={() => (asking = 'refund')}>Reembolsar</button
				>{/if}
		</div>
	</div>

	{#if asking === 'cancel'}
		<form method="POST" action="?/cancel" use:enhance class="card border border-error">
			<div class="card-body gap-3">
				<p>Se cancelará el pedido y se repondrá el stock reservado.</p>
				<input class="input w-full" name="reason" placeholder="Motivo (opcional)" maxlength="200" />
				<div class="flex gap-2">
					<button class="btn btn-error btn-sm">Sí, cancelar</button><button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => (asking = null)}>No</button
					>
				</div>
			</div>
		</form>
	{:else if asking === 'refund'}
		<form method="POST" action="?/refund" use:enhance class="card border border-error">
			<div class="card-body gap-3">
				<p>Se marcará el pedido como reembolsado. El dinero se devuelve por fuera de la app.</p>
				<label class="flex items-center gap-2"
					><input type="checkbox" class="checkbox checkbox-sm" name="restock" /> Reponer el stock de los
					productos</label
				>
				<div class="flex gap-2">
					<button class="btn btn-error btn-sm">Sí, reembolsar</button><button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => (asking = null)}>No</button
					>
				</div>
			</div>
		</form>
	{/if}

	{#if order.notes}<div role="status" class="alert alert-info"><span>{order.notes}</span></div>{/if}

	<div class="grid gap-5 lg:grid-cols-3">
		<div class="flex flex-col gap-5 lg:col-span-2">
			<section class="card border border-current/10" aria-labelledby="items">
				<div class="card-body gap-3">
					<h2 id="items" class="card-title">Productos</h2>
					<table class="table table-sm">
						<thead
							><tr
								><th>Producto</th><th>SKU</th><th class="text-end">Cant.</th><th class="text-end"
									>Total</th
								></tr
							></thead
						>
						<tbody>
							{#each data.items as item (item.id)}
								<tr>
									<td
										>{item.name}{#if item.label}
											<span class="opacity-60">({item.label})</span>{/if}</td
									>
									<td class="font-mono text-xs">{item.sku}</td>
									<td class="text-end">{item.qty}</td>
									<td class="text-end"><Money cents={item.total} /></td>
								</tr>
							{/each}
						</tbody>
					</table>
					<dl class="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
						<div class="flex justify-between">
							<dt>Subtotal</dt>
							<dd><Money cents={order.totals.subtotal} /></dd>
						</div>
						{#if order.totals.discount > 0}<div class="flex justify-between">
								<dt>Descuento</dt>
								<dd>−<Money cents={order.totals.discount} /></dd>
							</div>{/if}
						<div class="flex justify-between">
							<dt>IVA</dt>
							<dd><Money cents={order.totals.iva} /></dd>
						</div>
						<div
							class="flex justify-between border-t border-current/10 pt-1 text-base font-semibold"
						>
							<dt>Total</dt>
							<dd data-testid="sale-total"><Money cents={order.totals.total} /></dd>
						</div>
					</dl>
				</div>
			</section>

			<section class="card border border-current/10" aria-labelledby="pays">
				<div class="card-body gap-3">
					<h2 id="pays" class="card-title">Pagos</h2>
					<ul class="flex flex-col divide-y divide-current/10">
						{#each data.payments as p (p.id)}
							<li class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
								<span
									>{p.method} <span class="opacity-60">· {p.statusLabel}</span>{#if p.ref}
										<span class="font-mono text-xs opacity-60">({p.ref})</span>{/if}</span
								>
								{#if p.receipt}<span class="w-full text-xs opacity-60"
										>Recibo de Clip: <span class="font-mono">{p.receipt}</span></span
									>{/if}
								{#if p.note}
									<div
										role="alert"
										class="alert alert-error w-full text-sm"
										data-testid="payment-note"
									>
										{p.note}
									</div>
								{/if}
								<span class="flex items-center gap-3">
									{#if p.confirmedAt}<span class="opacity-60"
											>{formatDate(p.confirmedAt, { time: true })}</span
										>{/if}
									<Money cents={p.amount} />
								</span>
							</li>
						{/each}
					</ul>
					{#if data.proofHref}<a
							class="btn btn-outline btn-sm w-fit"
							href={data.proofHref}
							target="_blank"
							rel="noopener">Ver comprobante</a
						>{/if}
				</div>
			</section>
		</div>

		<div class="flex flex-col gap-5">
			<section class="card border border-current/10" aria-labelledby="who">
				<div class="card-body gap-1 text-sm">
					<h2 id="who" class="card-title">Cliente</h2>
					<p class="font-medium">{order.contact.name || 'Mostrador'}</p>
					{#if order.contact.email}<a class="link" href={`mailto:${order.contact.email}`}
							>{order.contact.email}</a
						>{/if}
					{#if order.contact.phone}<a class="link" href={`tel:${order.contact.phone}`}
							>{order.contact.phone}</a
						>{/if}
					<p class="mt-2 opacity-60">Creado: {formatDate(order.createdAt, { time: true })}</p>
					{#if order.paidAt}<p class="opacity-60">
							Pagado: {formatDate(order.paidAt, { time: true })}
						</p>{/if}
					{#if order.expiresAt}<p class="opacity-60">
							Vence: {formatDate(order.expiresAt, { time: true })}
						</p>{/if}
				</div>
			</section>

			{#if data.finance}
				<section class="card border border-dashed border-current/30" aria-labelledby="fin">
					<div class="card-body gap-1 text-sm">
						<h2 id="fin" class="card-title">
							Finanzas <span class="badge badge-info badge-sm">solo personal</span>
						</h2>
						<dl class="flex flex-col gap-1">
							<div class="flex justify-between">
								<dt>Precio base (neto)</dt>
								<dd><Money cents={data.finance.base} /></dd>
							</div>
							<div class="flex justify-between">
								<dt>Comisión Clip estimada</dt>
								<dd><Money cents={data.finance.fee} /></dd>
							</div>
							<div class="flex justify-between">
								<dt>IVA por enterar</dt>
								<dd><Money cents={order.totals.iva} /></dd>
							</div>
							<div class="flex justify-between border-t border-current/10 pt-1 font-semibold">
								<dt>Te quedan</dt>
								<dd data-testid="sale-net"><Money cents={data.finance.net} /></dd>
							</div>
						</dl>
						<p class="text-xs opacity-60">
							Tasas del pedido: IVA {data.finance.rates.iva}%{data.finance.feeApplied
								? `, Clip ${data.finance.rates.clip}%`
								: ''}.
						</p>
					</div>
				</section>
			{/if}
		</div>
	</div>
</div>
