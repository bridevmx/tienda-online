<script>
	import { enhance } from '$app/forms';
	import Field from './Field.svelte';

	/**
	 * Formulario generico de un recurso. `values`, `errors` y `files` vienen de la carga de la pagina o
	 * del resultado de la accion (si hubo errores, `form.values` trae lo que escribio el usuario).
	 */
	let {
		resource,
		values,
		errors = {},
		options = {},
		files = {},
		editing = false,
		readonly = false,
		submitLabel = 'Guardar',
		cancelHref,
		action = ''
	} = $props();

	let busy = $state(false);
</script>

<form
	method="POST"
	{action}
	enctype="multipart/form-data"
	class="flex flex-col gap-5"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	{#if errors._}
		<div role="alert" class="alert alert-error">{errors._}</div>
	{/if}

	<fieldset class="flex flex-col gap-5" disabled={readonly}>
		{#each resource.fields as field (field.name)}
			<Field
				{field}
				value={values[field.name]}
				error={errors[field.name]}
				options={options[field.name]}
				files={files[field.name]}
				{editing}
			/>
		{/each}
	</fieldset>

	<div class="flex items-center gap-2">
		{#if !readonly}
			<button class="btn btn-primary" disabled={busy}>{submitLabel}</button>
		{:else}
			<span class="badge badge-outline">Solo lectura</span>
		{/if}
		<a class="btn btn-ghost" href={cancelHref}>{readonly ? 'Volver' : 'Cancelar'}</a>
	</div>
</form>
