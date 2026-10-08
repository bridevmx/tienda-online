<script>
	import ChildTable from '#ui/crud/ChildTable.svelte';
	import ConfirmDelete from '#ui/crud/ConfirmDelete.svelte';
	import ResourceForm from '#ui/crud/ResourceForm.svelte';
	import { routes } from '#core/routes.js';

	let { data, form } = $props();
	const resource = $derived(data.resource);
	let deleting = $state(null);
</script>

<svelte:head>
	<title>{data.record.title} | Administración</title>
</svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
	<div class="breadcrumbs text-sm">
		<ul>
			<li><a href={routes.admin.home()}>Administración</a></li>
			<li><a href={routes.admin.list(resource.name)}>{resource.label[1]}</a></li>
			<li>{data.record.title}</li>
		</ul>
	</div>
	<h1 class="text-2xl font-semibold">{data.record.title}</h1>

	<div class="card border border-current/10">
		<div class="card-body">
			<ResourceForm
				{resource}
				values={form?.values ?? data.values}
				errors={form?.errors}
				options={data.options}
				files={data.files}
				editing
				action={data.saveAction}
				readonly={!data.canUpdate}
				cancelHref={data.backHref}
			/>
		</div>
	</div>

	{#each data.children as child (child.label)}
		<ChildTable {child} />
	{/each}

	{#if data.canDelete}
		<div class="flex justify-end">
			<button
				type="button"
				class="btn btn-outline btn-error btn-sm"
				onclick={() => (deleting = { id: data.record.id, title: data.record.title })}
			>
				Eliminar {resource.label[0].toLowerCase()}
			</button>
		</div>
		<ConfirmDelete
			bind:target={deleting}
			action={data.deleteAction}
			noun={resource.label[0].toLowerCase()}
		/>
	{/if}
</div>
