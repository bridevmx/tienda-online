<script>
	import { enhance } from '$app/forms';
	import Field from '#ui/Field.svelte';
	import { routes } from '#core/routes.js';

	let { form } = $props();
	const errors = $derived(form?.errors ?? {});
</script>

<svelte:head>
	<title>Nueva contraseña</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="mx-auto max-w-sm">
	<form method="POST" use:enhance class="card border border-current/10">
		<div class="card-body gap-3">
			<h1 class="card-title">Elige una nueva contraseña</h1>
			{#if errors._}
				<div role="alert" class="alert alert-error">
					{errors._}
					{#if form?.expired}<a class="link" href={routes.recover()}>Pedir otro</a>{/if}
				</div>
			{/if}
			<Field
				name="password"
				label="Nueva contraseña"
				type="password"
				{errors}
				autocomplete="new-password"
				hint="Mínimo 8 caracteres"
				required
				minlength={8}
			/>
			<Field
				name="passwordConfirm"
				label="Repite la contraseña"
				type="password"
				{errors}
				autocomplete="new-password"
				required
			/>
			<button class="btn btn-primary">Guardar contraseña</button>
		</div>
	</form>
</section>
