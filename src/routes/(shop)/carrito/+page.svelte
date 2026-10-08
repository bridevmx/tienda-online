<script>
	import { enhance } from '$app/forms';
	import Money from '#ui/shop/Money.svelte';
	import { routes } from '#core/routes.js';

	let { data } = $props();
	const cart = $derived(data.cart);

	const PROBLEMS = {
		unavailable: 'Este producto ya no está disponible. Quítalo para continuar.',
		out: 'Agotado. Quítalo para continuar.'
	};
</script>

<svelte:head>
	<title>Carrito | {data.storeName}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex flex-col gap-6">
	<h1 class="text-2xl font-semibold">
		Tu carrito {#if !cart.empty}<span class="text-base font-normal opacity-60">({cart.count})</span
			>{/if}
	</h1>

	{#if cart.empty}
		<div class="card border border-current/10">
			<div class="card-body items-center gap-3 py-12 text-center">
				<p class="text-lg">Tu carrito está vacío.</p>
				<a class="btn btn-primary" href={routes.products()}>Ver productos</a>
			</div>
		</div>
	{:else}
		<div class="grid gap-6 lg:grid-cols-3">
			<ul class="flex flex-col gap-3 lg:col-span-2">
				{#each cart.lines as line (line.variant)}
					<li class="card border border-current/10" data-testid="cart-line">
						<div class="card-body flex-row gap-4 p-4">
							{#if line.image}
								<img class="size-20 shrink-0 rounded-field object-cover" src={line.image} alt="" />
							{:else}
								<div class="size-20 shrink-0 rounded-field bg-current/5"></div>
							{/if}
							<div class="flex flex-1 flex-col gap-1">
								<div class="flex justify-between gap-3">
									<div>
										{#if line.href}<a class="font-medium hover:underline" href={line.href}
												>{line.name}</a
											>{:else}<span class="font-medium">{line.name}</span>{/if}
										{#if line.label}<p class="text-sm opacity-70">{line.label}</p>{/if}
									</div>
									{#if !line.problem || line.problem === 'stock'}<strong
											><Money cents={line.amount} /></strong
										>{/if}
								</div>

								{#if line.problem && PROBLEMS[line.problem]}
									<p class="text-error text-sm" role="alert">{PROBLEMS[line.problem]}</p>
								{:else if line.problem === 'stock'}
									<p class="text-error text-sm" role="alert">
										Solo hay {line.available} disponibles. Ajusta la cantidad.
									</p>
								{/if}

								<div class="mt-auto flex flex-wrap items-center gap-3">
									{#if line.problem !== 'unavailable' && line.problem !== 'out'}
										<form
											method="POST"
											action="?/set"
											use:enhance
											class="join"
											aria-label={`Cantidad de ${line.name}`}
										>
											<input type="hidden" name="variant" value={line.variant} />
											<button
												class="btn btn-sm join-item"
												name="qty"
												value={line.qty - 1}
												aria-label="Quitar una pieza">−</button
											>
											<span
												class="join-item flex items-center border border-current/20 px-4 text-sm tabular-nums"
												aria-live="polite">{line.qty}</span
											>
											<button
												class="btn btn-sm join-item"
												name="qty"
												value={line.qty + 1}
												disabled={line.qty >= line.available && line.problem !== 'stock'}
												aria-label="Agregar una pieza">+</button
											>
										</form>
									{/if}
									<form method="POST" action="?/remove" use:enhance>
										<input type="hidden" name="variant" value={line.variant} />
										<button class="btn btn-ghost btn-sm text-error">Quitar</button>
									</form>
								</div>
							</div>
						</div>
					</li>
				{/each}
			</ul>

			<aside class="card h-fit border border-current/10" aria-label="Resumen">
				<div class="card-body gap-3">
					<h2 class="card-title">Resumen</h2>
					{#if cart.totals.iva > 0}<p class="text-xs opacity-60">
							Los precios de tu carrito incluyen IVA.
						</p>{/if}
					<dl class="flex flex-col gap-2 text-sm">
						<div class="flex justify-between">
							<dt>Subtotal</dt>
							<dd><Money cents={cart.totals.subtotal} /></dd>
						</div>
						{#if cart.totals.iva > 0}
							<div class="flex justify-between">
								<dt>IVA</dt>
								<dd><Money cents={cart.totals.iva} /></dd>
							</div>
						{/if}
						<div
							class="flex justify-between border-t border-current/10 pt-2 text-base font-semibold"
						>
							<dt>Total</dt>
							<dd data-testid="cart-total"><Money cents={cart.totals.total} /></dd>
						</div>
					</dl>
					{#if cart.savings > 0}
						<p class="rounded-field bg-secondary/20 p-2 text-sm">
							Pagando en efectivo o transferencia ahorras <strong
								><Money cents={cart.savings} /></strong
							>.
						</p>
					{/if}
					{#if cart.canCheckout}
						<a class="btn btn-primary" href={routes.checkout()}>Continuar con la compra</a>
					{:else}
						<button class="btn btn-primary" disabled>Continuar con la compra</button>
						<p class="text-error text-sm" role="alert">
							Resuelve los avisos de tu carrito para continuar.
						</p>
					{/if}
					<form method="POST" action="?/clear" use:enhance>
						<button class="btn btn-ghost btn-sm w-full">Vaciar carrito</button>
					</form>
				</div>
			</aside>
		</div>
	{/if}
</div>
