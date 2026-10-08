<script>
	import { page } from '$app/state';
	import { formatMoney } from '#core/money.js';

	/**
	 * Simulador SOLO para el personal: muestra la comision de Clip, el IVA y lo que le queda a la
	 * tienda. Estos datos no se envian a clientes (la pagina solo los recibe si hay sesion de personal).
	 */
	let { simulator } = $props();
	let form;

	const c = (cents) => formatMoney(cents);
	const rows = $derived(
		[
			{ title: 'Con tarjeta', t: simulator.card },
			{ title: 'Efectivo o transferencia', t: simulator.other }
		].map(({ title, t }) => ({ title, view: t.customerView, internal: t.internal }))
	);
</script>

<aside
	class="card border border-dashed border-current/30"
	aria-label="Simulador de precio (solo personal)"
>
	<div class="card-body gap-3 p-4">
		<div class="flex items-center justify-between gap-2">
			<h2 class="font-semibold">
				Simulador de precio <span class="badge badge-info">solo personal</span>
			</h2>
		</div>
		<form
			method="GET"
			bind:this={form}
			class="flex flex-wrap gap-x-6 gap-y-2"
			data-sveltekit-noscroll
		>
			{#each page.url.searchParams.getAll('v') as v (v)}<input
					type="hidden"
					name="v"
					value={v}
				/>{/each}
			<label class="flex items-center gap-2">
				<input type="hidden" name="iva" value="0" />
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm"
					name="iva"
					value="1"
					checked={simulator.flags.iva}
					onchange={() => form.requestSubmit()}
				/>
				<span class="text-sm">Agregar IVA ({simulator.rates.iva}%)</span>
			</label>
			<label class="flex items-center gap-2">
				<input type="hidden" name="clip" value="0" />
				<input
					type="checkbox"
					class="toggle toggle-primary toggle-sm"
					name="clip"
					value="1"
					checked={simulator.flags.clip}
					onchange={() => form.requestSubmit()}
				/>
				<span class="text-sm">Agregar comisión de Clip ({simulator.rates.clip}% + IVA)</span>
			</label>
			<noscript><button class="btn btn-sm">Actualizar</button></noscript>
		</form>

		<p class="text-sm">
			Precio guardado (neto que quieres recibir): <strong>{c(simulator.base)}</strong>
		</p>

		<div class="grid gap-3 sm:grid-cols-2">
			{#each rows as row (row.title)}
				<table class="table table-sm">
					<caption class="mb-1 text-left text-sm font-medium">{row.title}</caption>
					<tbody>
						<tr><td>Subtotal de lista</td><td class="text-end">{c(row.view.subtotal)}</td></tr>
						{#if row.view.discount > 0}<tr
								><td>Descuento</td><td class="text-end">−{c(row.view.discount)}</td></tr
							>{/if}
						<tr><td>IVA</td><td class="text-end">{c(row.view.iva)}</td></tr>
						<tr class="font-semibold"
							><td>Cliente paga</td><td class="text-end">{c(row.view.total)}</td></tr
						>
						{#if row.internal.clipFee > 0}
							<tr><td>Comisión Clip</td><td class="text-end">−{c(row.internal.clipFee)}</td></tr>
							<tr
								><td>IVA de la comisión</td><td class="text-end">−{c(row.internal.clipFeeIva)}</td
								></tr
							>
						{/if}
						<tr><td>IVA por enterar</td><td class="text-end">−{c(row.view.iva)}</td></tr>
						<tr class="font-semibold"
							><td>Te quedan</td><td class="text-end">{c(row.internal.net)}</td></tr
						>
					</tbody>
				</table>
			{/each}
		</div>
	</div>
</aside>
