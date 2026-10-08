<script>
	/** Estado como texto + color del tema (primary | secondary | info | error). Nunca solo color. */
	let { label, badge = 'info' } = $props();
	const CLASSES = {
		primary: 'badge badge-primary',
		secondary: 'badge badge-secondary',
		info: 'badge badge-info',
		error: 'badge badge-error'
	};
</script>

<span class={CLASSES[badge] ?? 'badge badge-outline'}>{label}</span>
