<script>
	import { page } from '$app/state';
	import ThemeSwitcher from '#ui/ThemeSwitcher.svelte';
	import { routes } from '#core/routes.js';

	let { data, children } = $props();

	const active = (href) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<div class="drawer lg:drawer-open">
	<input id="admin-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex min-h-screen flex-col">
		<header class="navbar gap-2 border-b border-current/10 px-4">
			<label for="admin-drawer" class="btn btn-ghost btn-sm lg:hidden" aria-label="Abrir menú"
				>☰</label
			>
			<span class="font-semibold lg:hidden">Administración</span>
			<div class="ml-auto flex items-center gap-3 text-sm">
				<ThemeSwitcher current={page.data.theme} />
				<span class="hidden sm:inline">{data.user.name || data.user.email}</span>
				{#if data.user.role}<span class="badge badge-info">{data.user.role.name}</span>{/if}
				<form method="POST" action={routes.admin.logout()}>
					<button class="btn btn-sm">Salir</button>
				</form>
			</div>
		</header>
		<main class="flex-1 p-4 lg:p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for="admin-drawer" class="drawer-overlay" aria-label="Cerrar menú"></label>
		<aside class="min-h-full w-64 border-r border-current/10 bg-[canvas] p-3">
			<a class="mb-4 block px-3 py-2 text-lg font-semibold" href={routes.admin.home()}>
				Administración
			</a>
			{#each data.nav as group (group.label)}
				<ul class="menu w-full">
					<li class="menu-title">{group.label}</li>
					{#each group.items as item (item.href)}
						<li><a href={item.href} class:menu-active={active(item.href)}>{item.label}</a></li>
					{/each}
				</ul>
			{/each}
		</aside>
	</div>
</div>
