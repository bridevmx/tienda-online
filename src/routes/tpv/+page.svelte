<script>
	import { enhance } from '$app/forms';
	import { onMount, tick } from 'svelte';
	import Money from '#ui/shop/Money.svelte';
	import { formatMoney, toCents } from '#core/money.js';
	import { computeTotals } from '#core/pricing.js';
	import { findByCode, matchItems } from '#modules/pos/catalog.js';

	let { data, form } = $props();

	let query = $state('');
	let category = $state('');
	/** Ticket: variantId -> cantidad. */
	let ticket = $state({});
	let searchEl = $state();
	let dialog = $state();
	let method = $state('cash');
	let receivedText = $state('');
	let busy = $state(false);
	let notice = $state('');

	const byId = $derived(new Map(data.items.map((i) => [i.id, i])));
	const visible = $derived(matchItems(data.items, query, category));
	const lines = $derived(
		Object.entries(ticket)
			.map(([id, qty]) => ({ item: byId.get(id), qty }))
			.filter((l) => l.item && l.qty > 0)
	);
	const count = $derived(lines.reduce((n, l) => n + l.qty, 0));
	const base = $derived(lines.reduce((sum, l) => sum + l.item.base * l.qty, 0));
	// el TPV es de personal: se muestran ambos precios (tarjeta y efectivo/transferencia)
	const totalsFor = (m) => computeTotals({ baseCents: base, method: m, config: data.config });
	const card = $derived(totalsFor('card_clip').customerView);
	const other = $derived(totalsFor('cash').customerView);
	const current = $derived(method === 'card_clip' ? card : other);
	const received = $derived.by(() => {
		try {
			return receivedText.trim() ? toCents(receivedText) : 0;
		} catch {
			return 0;
		}
	});
	const change = $derived(received - current.total);
	const quick = $derived(
		[
			...new Set([
				other.total,
				...[100, 200, 500, 1000].map((n) => Math.ceil(other.total / (n * 100)) * n * 100)
			])
		]
			.filter((n) => n >= other.total)
			.slice(0, 4)
	);

	function add(item, qty = 1) {
		const have = ticket[item.id] ?? 0;
		if (have + qty > item.stock) {
			notice =
				item.stock <= 0 ? `${item.name} está agotado` : `Solo hay ${item.stock} de ${item.name}`;
			return;
		}
		if (have + qty > 99) return;
		notice = '';
		ticket[item.id] = have + qty;
	}
	function setQty(item, qty) {
		if (qty <= 0) delete ticket[item.id];
		else if (qty <= item.stock && qty <= 99) ticket[item.id] = qty;
	}
	function clear() {
		ticket = {};
		notice = '';
	}

	/** Enter en el buscador: lector de codigos (SKU/codigo exacto) o la unica coincidencia. */
	function onEnter(event) {
		event.preventDefault();
		const exact = findByCode(data.items, query);
		const target = exact ?? (visible.length === 1 ? visible[0] : null);
		if (target) {
			add(target);
			query = '';
		} else if (!visible.length) notice = 'No encontré ese producto';
	}

	async function openCharge() {
		if (!lines.length) return;
		method = 'cash';
		receivedText = '';
		dialog.showModal();
		await tick();
	}

	// si el cobro fallo (p. ej. se agoto una pieza) el dialogo vuelve a mostrarse con el error
	$effect(() => {
		if (form?.error && dialog && !dialog.open) dialog.showModal();
	});

	onMount(() => {
		searchEl?.focus();
		const onKey = (e) => {
			if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
				e.preventDefault();
				searchEl?.focus();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const canSubmit = $derived(
		lines.length > 0 &&
			data.methods[method] &&
			(method !== 'cash' || received === 0 || received >= current.total)
	);
</script>

<svelte:head><title>Vender | TPV</title></svelte:head>

<div class="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_24rem]">
	<!-- catalogo -->
	<section class="flex min-h-0 flex-col gap-3 p-3" aria-label="Productos">
		<div class="flex flex-wrap gap-2">
			<label class="input flex-1">
				<input
					bind:this={searchEl}
					bind:value={query}
					type="search"
					placeholder="Buscar o escanear (SKU / código de barras) — Enter para agregar"
					aria-label="Buscar producto"
					autocomplete="off"
					onkeydown={(e) => e.key === 'Enter' && onEnter(e)}
				/>
			</label>
		</div>
		{#if data.categories.length}
			<div class="flex gap-1 overflow-x-auto" role="group" aria-label="Categorías">
				<button
					class="btn btn-sm {category === '' ? 'btn-primary' : ''}"
					onclick={() => (category = '')}>Todo</button
				>
				{#each data.categories as c (c.id)}
					<button
						class="btn btn-sm whitespace-nowrap {category === c.id ? 'btn-primary' : ''}"
						onclick={() => (category = c.id)}>{c.name}</button
					>
				{/each}
			</div>
		{/if}
		{#if notice}<p role="alert" class="text-error text-sm">{notice}</p>{/if}

		<ul
			class="grid auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4"
			data-testid="pos-grid"
		>
			{#each visible as item (item.id)}
				<li>
					<button
						class="card h-full w-full border border-current/10 text-left hover:border-primary disabled:opacity-40"
						disabled={item.stock <= 0}
						onclick={() => add(item)}
						data-sku={item.sku}
					>
						{#if item.image}
							<figure class="aspect-square overflow-hidden">
								<img src={item.image} alt="" class="h-full w-full object-cover" loading="lazy" />
							</figure>
						{/if}
						<div class="card-body gap-0 p-3">
							<span class="line-clamp-2 text-sm font-medium">{item.name}</span>
							{#if item.label}<span class="text-xs opacity-70">{item.label}</span>{/if}
							<span class="mt-1 flex items-center justify-between text-sm">
								<strong
									><Money
										cents={computeTotals({
											baseCents: item.base,
											method: 'cash',
											config: data.config
										}).customerView.total}
									/></strong
								>
								<span class="text-xs opacity-60"
									>{item.stock <= 0 ? 'Agotado' : `${item.stock} pzs`}</span
								>
							</span>
						</div>
					</button>
				</li>
			{:else}
				<li class="col-span-full opacity-70">Sin resultados.</li>
			{/each}
		</ul>
	</section>

	<!-- ticket -->
	<aside
		class="flex flex-col border-t border-current/10 lg:border-t-0 lg:border-l"
		aria-label="Ticket"
	>
		<div class="flex items-center justify-between p-3">
			<h2 class="font-semibold">Ticket <span class="badge badge-sm">{count}</span></h2>
			<button class="btn btn-ghost btn-xs" onclick={clear} disabled={!lines.length}>Vaciar</button>
		</div>
		<ul class="flex-1 overflow-y-auto px-3" data-testid="pos-ticket">
			{#each lines as { item, qty } (item.id)}
				<li class="flex items-center gap-2 border-b border-current/10 py-2">
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm">{item.name}{item.label ? ` (${item.label})` : ''}</p>
						<p class="text-xs opacity-60">{item.sku}</p>
					</div>
					<div class="join">
						<button
							class="join-item btn btn-xs"
							aria-label="Quitar uno"
							onclick={() => setQty(item, qty - 1)}>−</button
						>
						<span class="join-item btn btn-xs btn-ghost pointer-events-none tabular-nums"
							>{qty}</span
						>
						<button
							class="join-item btn btn-xs"
							aria-label="Agregar uno"
							onclick={() => setQty(item, qty + 1)}>+</button
						>
					</div>
				</li>
			{:else}
				<li class="py-6 text-center text-sm opacity-60">Agrega productos para empezar.</li>
			{/each}
		</ul>
		<div class="flex flex-col gap-2 border-t border-current/10 p-3">
			<dl class="flex flex-col gap-1 text-sm">
				<div class="flex justify-between">
					<dt>Efectivo / transferencia</dt>
					<dd class="font-semibold" data-testid="pos-total-cash"><Money cents={other.total} /></dd>
				</div>
				<div class="flex justify-between opacity-80">
					<dt>Tarjeta</dt>
					<dd data-testid="pos-total-card"><Money cents={card.total} /></dd>
				</div>
			</dl>
			<button
				class="btn btn-primary btn-lg"
				disabled={!lines.length}
				onclick={openCharge}
				data-testid="pos-charge"
			>
				Cobrar {lines.length ? formatMoney(other.total) : ''}
			</button>
		</div>
	</aside>
</div>

<!-- cobro -->
<dialog bind:this={dialog} class="modal">
	<div class="modal-box max-w-md">
		<form
			method="POST"
			action="?/charge"
			class="flex flex-col gap-4"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<h2 class="text-lg font-semibold">Cobrar</h2>
			{#if form?.error}<div role="alert" class="alert alert-error">{form.error}</div>{/if}

			<input
				type="hidden"
				name="lines"
				value={JSON.stringify(lines.map((l) => ({ variant: l.item.id, qty: l.qty })))}
			/>
			<input type="hidden" name="method" value={method} />
			<input type="hidden" name="received" value={method === 'cash' ? received : ''} />

			<div role="tablist" class="join w-full">
				{#each [['cash', 'Efectivo'], ['transfer', 'Transferencia'], ['card_clip', 'Tarjeta']] as [id, label] (id)}
					<button
						type="button"
						role="tab"
						aria-selected={method === id}
						class="join-item btn flex-1 {method === id ? 'btn-primary' : ''}"
						disabled={!data.methods[id]}
						onclick={() => (method = id)}>{label}</button
					>
				{/each}
			</div>

			<p class="text-center text-3xl font-semibold" data-testid="pos-due">
				<Money cents={current.total} />
			</p>
			{#if current.discount > 0}
				<p class="text-center text-sm opacity-70">
					Incluye descuento de <Money cents={current.discount} /> por no pagar con tarjeta
				</p>
			{/if}

			{#if method === 'cash'}
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium">Efectivo recibido</span>
					<input
						class="input input-lg w-full"
						inputmode="decimal"
						bind:value={receivedText}
						placeholder="0.00"
						data-testid="pos-received"
					/>
				</label>
				<div class="flex flex-wrap gap-2">
					{#each quick as amount (amount)}
						<button
							type="button"
							class="btn btn-sm"
							onclick={() => (receivedText = String(amount / 100))}
						>
							<Money cents={amount} />
						</button>
					{/each}
				</div>
				{#if received > 0}
					<p class="text-center text-lg" data-testid="pos-change">
						{#if change >= 0}Cambio: <strong><Money cents={change} /></strong>{:else}<span
								class="text-error">Faltan <Money cents={-change} /></span
							>{/if}
					</p>
				{/if}
			{:else if method === 'transfer'}
				<dl class="rounded-box border border-current/10 p-3 text-sm">
					<dt class="opacity-70">Beneficiario</dt>
					<dd>{data.transfer.beneficiary}</dd>
					<dt class="mt-1 opacity-70">Banco</dt>
					<dd>{data.transfer.bank}</dd>
					<dt class="mt-1 opacity-70">CLABE</dt>
					<dd class="font-mono">{data.transfer.clabe}</dd>
				</dl>
				<p class="text-sm opacity-70">Confirma solo cuando veas la transferencia recibida.</p>
			{:else}
				<p class="text-sm opacity-70">
					Se genera un código QR con el link de pago de Clip para que el cliente lo escanee.
				</p>
			{/if}

			<details class="text-sm">
				<summary class="cursor-pointer opacity-70">Datos del cliente (opcional)</summary>
				<div class="mt-2 flex flex-col gap-2">
					<input class="input w-full" name="name" placeholder="Nombre" autocomplete="off" />
					<input
						class="input w-full"
						type="email"
						name="email"
						placeholder="Correo"
						autocomplete="off"
					/>
				</div>
			</details>

			<div class="modal-action mt-0">
				<button type="button" class="btn" onclick={() => dialog.close()}>Volver</button>
				<button class="btn btn-primary" disabled={busy || !canSubmit} data-testid="pos-confirm">
					{method === 'card_clip'
						? 'Generar cobro'
						: method === 'transfer'
							? 'Transferencia recibida'
							: 'Cobrar'}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>
