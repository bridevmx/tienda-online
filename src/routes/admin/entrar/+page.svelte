<script>
	import { enhance } from '$app/forms';
	import LoginForm from '#ui/LoginForm.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Entrar | Administración</title>
</svelte:head>

<LoginForm title="Administración" {form} {enhance} />
