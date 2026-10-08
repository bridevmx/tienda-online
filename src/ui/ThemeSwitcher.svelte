<script>
	import { THEMES, THEME_COOKIE } from '#core/themes.js';

	let { current = THEMES[0].id } = $props();

	function apply(id) {
		document.documentElement.setAttribute('data-theme', id);
		document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
	}
</script>

<label class="flex items-center gap-2 text-sm">
	<span>Tema</span>
	<select
		class="select select-sm"
		value={current}
		onchange={(e) => apply(e.currentTarget.value)}
		aria-label="Cambiar tema"
	>
		{#each THEMES as theme (theme.id)}
			<option value={theme.id}>{theme.label}</option>
		{/each}
	</select>
</label>
