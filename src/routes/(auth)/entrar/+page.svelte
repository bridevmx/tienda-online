<script>
	import { enhance } from '$app/forms';
	import { routes } from '#core/routes.js';
	import LoginForm from '#ui/LoginForm.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Entrar</title>
</svelte:head>

<LoginForm title="Entrar a tu cuenta" {form} {enhance}>
	<div class="flex flex-wrap justify-between gap-2 text-sm">
		<a class="link" href={routes.recover()}>¿Olvidaste tu contraseña?</a>
		<a class="link" href={routes.register()}>Crear cuenta</a>
	</div>
</LoginForm>
