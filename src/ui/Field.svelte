<script>
	/** Campo de formulario con etiqueta y error. `errors` es el objeto { campo: mensaje } de la accion. */
	let {
		name,
		label,
		type = 'text',
		value = '',
		errors = {},
		autocomplete,
		required = false,
		hint = '',
		minlength,
		maxlength
	} = $props();
</script>

<label class="flex flex-col gap-1">
	<span class="text-sm font-medium">{label}</span>
	<input
		class="input w-full"
		class:input-error={errors[name]}
		{type}
		{name}
		{value}
		{autocomplete}
		{required}
		{minlength}
		{maxlength}
		aria-invalid={errors[name] ? 'true' : undefined}
	/>
	{#if hint && !errors[name]}<span class="text-xs opacity-60">{hint}</span>{/if}
	{#if errors[name]}<span class="text-error text-sm" role="alert">{errors[name]}</span>{/if}
</label>
