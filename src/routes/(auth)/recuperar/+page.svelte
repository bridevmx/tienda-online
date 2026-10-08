<script>
	import { enhance } from '$app/forms';
	import Field from '#ui/Field.svelte';
	import { routes } from '#core/routes.js';

	let { form } = $props();
	const errors = $derived(form?.errors ?? {});
</script>

<svelte:head>
	<title>Recuperar contraseña</title>
</svelte:head>

<section class="mx-auto max-w-sm">
	<div class="card border border-current/10">
		<div class="card-body gap-3">
			<h1 class="card-title">Recuperar contraseña</h1>
			{#if form?.sent}
				<div role="status" class="alert alert-info">
					Si ese correo tiene cuenta, te enviamos las instrucciones. Revisa también tu spam.
				</div>
			{:else}
				<form method="POST" use:enhance class="flex flex-col gap-3">
					{#if errors._}<div role="alert" class="alert alert-error">{errors._}</div>{/if}
					<Field
						name="email"
						label="Correo"
						type="email"
						value={form?.values?.email}
						{errors}
						autocomplete="email"
						required
					/>
					<button class="btn btn-primary">Enviar instrucciones</button>
				</form>
			{/if}
			<a class="link text-sm" href={routes.login()}>Volver a entrar</a>
		</div>
	</div>
</section>
