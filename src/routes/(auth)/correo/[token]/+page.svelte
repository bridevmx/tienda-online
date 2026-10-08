<script>
	import { enhance } from '$app/forms';
	import Field from '#ui/Field.svelte';

	let { form } = $props();
	const errors = $derived(form?.errors ?? {});
</script>

<svelte:head>
	<title>Confirmar correo</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="mx-auto max-w-sm">
	<form method="POST" use:enhance class="card border border-current/10">
		<div class="card-body gap-3">
			<h1 class="card-title">Confirma tu nuevo correo</h1>
			<p class="text-sm opacity-70">Por seguridad, escribe tu contraseña actual.</p>
			<Field
				name="password"
				label="Contraseña"
				type="password"
				{errors}
				autocomplete="current-password"
				required
			/>
			<button class="btn btn-primary">Confirmar</button>
		</div>
	</form>
</section>
