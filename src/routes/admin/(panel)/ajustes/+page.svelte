<script>
	import { enhance } from '$app/forms';
	import Field from '#ui/crud/Field.svelte';

	let { data, form } = $props();
	let busy = $state(false);

	// tras un error se repinta lo escrito; checkbox ausente = apagado
	const valueOf = (field) => {
		const raw = form?.values;
		if (!raw) return field.value;
		return field.type === 'checkbox'
			? raw[field.name] !== undefined && raw[field.name] !== 'off'
			: (raw[field.name] ?? '');
	};
</script>

<svelte:head>
	<title>Ajustes | Administración</title>
</svelte:head>

<form
	method="POST"
	class="mx-auto flex max-w-4xl flex-col gap-8"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-2xl font-semibold">Ajustes</h1>
		{#if data.canUpdate}
			<button class="btn btn-primary" disabled={busy}>Guardar cambios</button>
		{:else}
			<span class="badge badge-outline">Solo lectura</span>
		{/if}
	</div>

	{#if form?.errors}
		<div role="alert" class="alert alert-error">Revisa los campos marcados.</div>
	{/if}

	<fieldset class="contents" disabled={!data.canUpdate}>
		{#each data.groups as group (group.id)}
			<section class="grid gap-4 lg:grid-cols-3" aria-labelledby={`g-${group.id}`}>
				<div>
					<h2 id={`g-${group.id}`} class="font-semibold">{group.title}</h2>
					<p class="mt-1 text-sm opacity-70">{group.description}</p>
				</div>
				<div class="card border border-current/10 lg:col-span-2">
					<div class="card-body gap-5">
						{#each group.fields as field (field.name)}
							<Field {field} value={valueOf(field)} error={form?.errors?.[field.name]} />
						{/each}
					</div>
				</div>
			</section>
		{/each}
	</fieldset>
</form>
