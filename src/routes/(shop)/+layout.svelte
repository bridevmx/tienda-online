<script>
	import ShopShell from '#ui/shop/ShopShell.svelte';

	let { children } = $props();
</script>

<ShopShell>{@render children()}</ShopShell>
