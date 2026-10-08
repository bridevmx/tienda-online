<script>
	/** Aviso de una sola vez (ver core/flash.js). Se cierra solo. */
	let { flash } = $props();
	let visible = $state(true);

	$effect(() => {
		if (!flash) return;
		visible = true;
		const timer = setTimeout(() => (visible = false), 4500);
		return () => clearTimeout(timer);
	});
</script>

{#if flash && visible}
	<div class="toast toast-top toast-end z-50" role="status">
		<div class="alert {flash.type === 'error' ? 'alert-error' : 'alert-info'}">
			<span>{flash.text}</span>
		</div>
	</div>
{/if}
