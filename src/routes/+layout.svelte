<script>
	import '../app.css';
	import ThemeSwitcher from '#ui/ThemeSwitcher.svelte';

	let { data, children } = $props();
</script>

<div class="min-h-screen">
	<header class="navbar border-b border-current/10 px-4">
		<a class="text-lg font-semibold" href="/">Tienda online</a>
		<div class="ml-auto"><ThemeSwitcher current={data.theme} /></div>
	</header>
	<main class="mx-auto max-w-5xl p-4">
		{@render children()}
	</main>
</div>
