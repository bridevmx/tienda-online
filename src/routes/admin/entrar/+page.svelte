<script>
	import { enhance } from '$app/forms';
	import LoginForm from '#ui/LoginForm.svelte';
	import PublicShell from '#ui/PublicShell.svelte';

	let { form } = $props();
</script>

<svelte:head>
	<title>Entrar | Administración</title>
</svelte:head>

<PublicShell>
	<LoginForm title="Administración" {form} {enhance} />
</PublicShell>
