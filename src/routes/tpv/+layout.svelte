<script>
	import { page } from '$app/state';
	import ThemeSwitcher from '#ui/ThemeSwitcher.svelte';
	import { routes } from '#core/routes.js';

	let { data, children } = $props();
	const tabs = [
		{ href: routes.pos.home(), label: 'Vender' },
		{ href: routes.pos.sales(), label: 'Mis ventas' }
	];
</script>

<div class="flex min-h-screen flex-col print:block">
	<header class="navbar gap-2 border-b border-current/10 px-3 print:hidden">
		<span class="font-semibold">{data.storeName} · TPV</span>
		<nav class="join ml-2" aria-label="TPV">
			{#each tabs as tab (tab.href)}
				<a
					class="join-item btn btn-sm {page.url.pathname === tab.href ? 'btn-primary' : ''}"
					href={tab.href}>{tab.label}</a
				>
			{/each}
		</nav>
		<div class="ml-auto flex items-center gap-1">
			<span class="hidden text-sm opacity-70 sm:inline">{data.cashier.name}</span>
			{#if data.canAdmin}<a class="btn btn-ghost btn-sm" href={routes.admin.home()}>Admin</a>{/if}
			<ThemeSwitcher current={page.data.theme} />
			<form method="POST" action={routes.admin.logout()}>
				<button class="btn btn-ghost btn-sm">Salir</button>
			</form>
		</div>
	</header>
	<main class="flex min-h-0 flex-1 flex-col">
		{@render children()}
	</main>
</div>
