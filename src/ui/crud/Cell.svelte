<script>
	/** Una celda ya formateada por el servidor (ver core/crud-format.js). */
	let { cell } = $props();

	// clases completas (Tailwind no detecta nombres armados con texto)
	const BADGES = {
		primary: 'badge badge-primary',
		secondary: 'badge badge-secondary',
		info: 'badge badge-info',
		error: 'badge badge-error'
	};
</script>

{#if cell.type === 'badge'}
	{#if cell.text}<span class={BADGES[cell.badge] ?? 'badge badge-outline'}>{cell.text}</span>{/if}
{:else if cell.type === 'image'}
	{#if cell.src}
		<img class="size-10 rounded-field object-cover" src={cell.src} alt="" loading="lazy" />
	{:else}
		<div class="size-10 rounded-field border border-current/10"></div>
	{/if}
{:else}
	<span
		class:opacity-60={cell.muted}
		class:font-mono={cell.mono}
		class:text-sm={cell.mono}
		class:whitespace-nowrap={cell.mono}>{cell.text}</span
	>
{/if}
