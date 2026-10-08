<script>
	/** Chips de opciones (Talla, Color…). Son enlaces: la seleccion vive en la URL. */
	let { options } = $props();

	const label = (value) =>
		value.status === 'soldout'
			? `${value.value} (agotado)`
			: value.status === 'impossible'
				? `${value.value} (no disponible con la selección actual)`
				: value.value;
</script>

<div class="flex flex-col gap-4">
	{#each options as option (option.id)}
		<fieldset>
			<legend class="mb-2 text-sm font-medium">
				{option.name}:
				<span class="font-normal opacity-70"
					>{option.values.find((v) => v.selected)?.value ?? 'Elige una opción'}</span
				>
			</legend>
			<ul class="flex flex-wrap gap-2">
				{#each option.values as value (value.id)}
					<li>
						<a
							href={value.href}
							data-sveltekit-noscroll
							data-sveltekit-replacestate
							aria-label={label(value)}
							aria-current={value.selected ? 'true' : undefined}
							class="btn btn-sm {value.selected ? 'btn-primary' : 'btn-outline'} {value.status ===
							'impossible'
								? 'opacity-40'
								: ''} {value.status === 'soldout' ? 'line-through opacity-60' : ''}"
						>
							{value.value}
						</a>
					</li>
				{/each}
			</ul>
		</fieldset>
	{/each}
</div>
