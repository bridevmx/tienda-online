<script>
	import { enhance } from '$app/forms';
	import LoginForm from '#ui/LoginForm.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Entrar</title>
</svelte:head>

<LoginForm title="Entrar a tu cuenta" {form} {enhance} />
