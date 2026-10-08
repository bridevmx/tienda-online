<script>
	import { enhance } from '$app/forms';
	import Field from '#ui/Field.svelte';
	import { routes } from '#core/routes.js';

	let { form } = $props();
	const errors = $derived(form?.errors ?? {});
	const v = $derived(form?.values ?? {});
</script>

<svelte:head>
	<title>Crear cuenta</title>
</svelte:head>

<section class="mx-auto max-w-sm">
	<form method="POST" use:enhance class="card border border-current/10">
		<div class="card-body gap-3">
			<h1 class="card-title">Crear cuenta</h1>
			<p class="text-sm opacity-70">
				Opcional: con una cuenta ves tus pedidos y su estatus. Comprar sin cuenta también funciona.
			</p>
			{#if errors._}<div role="alert" class="alert alert-error">{errors._}</div>{/if}
			<Field
				name="name"
				label="Nombre completo"
				value={v.name}
				{errors}
				autocomplete="name"
				required
			/>
			<Field
				name="email"
				label="Correo"
				type="email"
				value={v.email}
				{errors}
				autocomplete="email"
				required
			/>
			<Field
				name="phone"
				label="Teléfono (opcional)"
				type="tel"
				value={v.phone}
				{errors}
				autocomplete="tel"
			/>
			<Field
				name="password"
				label="Contraseña"
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
			<button class="btn btn-primary">Crear cuenta</button>
			<p class="text-sm">¿Ya tienes cuenta? <a class="link" href={routes.login()}>Entra</a></p>
		</div>
	</form>
</section>
