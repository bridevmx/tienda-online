<script>
	import { enhance } from '$app/forms';
	import Money from '#ui/shop/Money.svelte';
	import { routes } from '#core/routes.js';

	let { data, form } = $props();
	const values = $derived(form?.values ?? data.values);
	const errors = $derived(form?.errors ?? {});

	// lo que el cliente eligio; mientras no elija, lo recordado tras un error o el primer metodo disponible
	let picked = $state(null);
	const method = $derived(picked ?? form?.values?.method ?? data.values.method);
	const chosen = $derived(data.methods.find((m) => m.id === method));
	const totals = $derived(chosen?.totals ?? data.cart.totals);
	const anyAvailable = $derived(data.methods.some((m) => m.available));
	let busy = $state(false);
</script>

<svelte:head>
	<title>Finalizar compra | {data.storeName}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex flex-col gap-6">
	<div class="breadcrumbs text-sm">
		<ul>
			<li><a href={routes.cart()}>Carrito</a></li>
			<li>Finalizar compra</li>
		</ul>
	</div>
	<h1 class="text-2xl font-semibold">Finalizar compra</h1>

	<form
		method="POST"
		class="grid gap-6 lg:grid-cols-3"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<div class="flex flex-col gap-6 lg:col-span-2">
			{#if errors.lines}
				<div role="alert" class="alert alert-error">
					<span>{errors.lines} <a class="link" href={routes.cart()}>Revisar carrito</a></span>
				</div>
			{/if}

			<section class="card border border-current/10" aria-labelledby="contact">
				<div class="card-body gap-4">
					<h2 id="contact" class="card-title">Tus datos</h2>
					{#if !data.account}
						<p class="text-sm opacity-70">
							¿Ya tienes cuenta? <a
								class="link"
								href={`${routes.login()}?next=${routes.checkout()}`}>Entra</a
							> para ver tus pedidos. Comprar sin cuenta también funciona.
						</p>
					{/if}
					<label class="flex flex-col gap-1">
						<span class="text-sm font-medium">Nombre completo</span>
						<input
							class="input w-full {errors['contact.name'] ? 'input-error' : ''}"
							name="name"
							autocomplete="name"
							value={values.name}
							required
						/>
						{#if errors['contact.name']}<span class="text-error text-sm" role="alert"
								>{errors['contact.name']}</span
							>{/if}
					</label>
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="flex flex-col gap-1">
							<span class="text-sm font-medium">Correo</span>
							<input
								class="input w-full {errors['contact.email'] ? 'input-error' : ''}"
								type="email"
								name="email"
								autocomplete="email"
								value={values.email}
								required
							/>
							{#if errors['contact.email']}<span class="text-error text-sm" role="alert"
									>{errors['contact.email']}</span
								>{/if}
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-sm font-medium">Teléfono (opcional)</span>
							<input
								class="input w-full {errors['contact.phone'] ? 'input-error' : ''}"
								type="tel"
								name="phone"
								autocomplete="tel"
								value={values.phone}
							/>
							{#if errors['contact.phone']}<span class="text-error text-sm" role="alert"
									>{errors['contact.phone']}</span
								>{/if}
						</label>
					</div>
				</div>
			</section>

			<section class="card border border-current/10" aria-labelledby="pay">
				<div class="card-body gap-3">
					<h2 id="pay" class="card-title">Forma de pago</h2>
					{#if !anyAvailable}
						<p class="text-error" role="alert">
							Por ahora no hay formas de pago disponibles. Escríbenos para completar tu compra.
						</p>
					{/if}
					{#each data.methods as m (m.id)}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-box border p-4 {method === m.id
								? 'border-primary'
								: 'border-current/15'} {m.available ? '' : 'opacity-50'}"
						>
							<input
								type="radio"
								class="radio radio-primary mt-1"
								name="method"
								value={m.id}
								checked={method === m.id}
								onchange={() => (picked = m.id)}
								disabled={!m.available}
								required
							/>
							<span class="flex-1">
								<span class="block font-medium">{m.label}</span>
								<span class="block text-sm opacity-70"
									>{m.available ? m.hint : 'No disponible por el momento.'}</span
								>
							</span>
							{#if m.available}<strong><Money cents={m.totals.total} /></strong>{/if}
						</label>
					{/each}
					{#if errors.method}<p class="text-error text-sm" role="alert">{errors.method}</p>{/if}
					{#if data.methods.some((m) => m.totals.discount > 0)}
						<p class="text-sm opacity-70">
							Pagando con transferencia el total es menor: ya incluye tu descuento.
						</p>
					{/if}
				</div>
			</section>
		</div>

		<aside class="card h-fit border border-current/10" aria-label="Resumen del pedido">
			<div class="card-body gap-3">
				<h2 class="card-title">Resumen</h2>
				<ul class="flex flex-col gap-2 text-sm">
					{#each data.cart.lines as line (line.variant)}
						<li class="flex justify-between gap-3">
							<span
								>{line.qty} × {line.name}{#if line.label}
									<span class="opacity-60">({line.label})</span>{/if}</span
							>
						</li>
					{/each}
				</ul>
				<dl class="flex flex-col gap-2 border-t border-current/10 pt-3 text-sm">
					<div class="flex justify-between">
						<dt>Subtotal</dt>
						<dd><Money cents={totals.subtotal} /></dd>
					</div>
					{#if totals.discount > 0}
						<div class="flex justify-between">
							<dt>Descuento por pagar con transferencia</dt>
							<dd>−<Money cents={totals.discount} /></dd>
						</div>
					{/if}
					{#if totals.iva > 0}
						<div class="flex justify-between">
							<dt>IVA</dt>
							<dd><Money cents={totals.iva} /></dd>
						</div>
					{/if}
					<div class="flex justify-between border-t border-current/10 pt-2 text-base font-semibold">
						<dt>Total</dt>
						<dd data-testid="checkout-total"><Money cents={totals.total} /></dd>
					</div>
				</dl>
				<button class="btn btn-primary" disabled={busy || !anyAvailable}>
					{method === 'card_clip' ? 'Pagar con tarjeta' : 'Confirmar pedido'}
				</button>
				<p class="text-xs opacity-60">
					Al confirmar reservamos tus productos. Si es transferencia, tienes tiempo limitado para
					pagar.
				</p>
			</div>
		</aside>
	</form>
</div>
