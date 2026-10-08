<script>
	import PublicShell from '#ui/PublicShell.svelte';

	let { children } = $props();
</script>

<PublicShell>{@render children()}</PublicShell>
