<script>
	import ResourceForm from '#ui/crud/ResourceForm.svelte';
	import { routes } from '#core/routes.js';

	let { data, form } = $props();
	const resource = $derived(data.resource);
</script>

<svelte:head>
	<title
		>{resource.feminine ? 'Nueva' : 'Nuevo'}
		{resource.label[0].toLowerCase()} | Administración</title
	>
</svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-4">
	<div class="breadcrumbs text-sm">
		<ul>
			<li><a href={routes.admin.home()}>Administración</a></li>
			<li><a href={routes.admin.list(resource.name)}>{resource.label[1]}</a></li>
			<li>Nuevo</li>
		</ul>
	</div>
	<h1 class="text-2xl font-semibold">
		{resource.feminine ? 'Nueva' : 'Nuevo'}
		{resource.label[0].toLowerCase()}
	</h1>

	<div class="card border border-current/10">
		<div class="card-body">
			<ResourceForm
				{resource}
				values={form?.values ?? data.values}
				errors={form?.errors}
				options={data.options}
				submitLabel="Crear"
				cancelHref={data.backHref}
			/>
		</div>
	</div>
</div>
