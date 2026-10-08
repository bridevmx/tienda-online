<script>
	let { data } = $props();
</script>

<svelte:head>
	<title>Administración</title>
</svelte:head>

<section class="card border border-current/10">
	<div class="card-body">
		<h1 class="card-title">Hola, {data.user.name || data.user.email}</h1>
		<p>
			Rol: <strong>{data.user.role?.name ?? 'sin rol'}</strong>. Los módulos del admin llegan en las
			siguientes fases.
		</p>
		<details>
			<summary class="cursor-pointer">Tus permisos ({data.permissions.length})</summary>
			<ul class="mt-2 flex flex-wrap gap-2">
				{#each data.permissions as code (code)}
					<li class="badge badge-secondary">{code}</li>
				{/each}
			</ul>
		</details>
	</div>
</section>
