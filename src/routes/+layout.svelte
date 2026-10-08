<script>
	import '../app.css';
	import Flash from '#ui/Flash.svelte';

	let { data, children } = $props();
</script>

<Flash flash={data.flash} />
{@render children()}
