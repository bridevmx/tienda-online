<script>
	import { page } from '$app/state';
	import { routes } from '#core/routes.js';

	let { children } = $props();
	const links = [
		{ href: routes.account(), label: 'Mis pedidos' },
		{ href: routes.profile(), label: 'Mis datos' }
	];
</script>

<div class="grid gap-6 md:grid-cols-[12rem_1fr]">
	<nav aria-label="Mi cuenta" class="flex flex-col gap-2">
		<ul class="menu menu-horizontal md:menu-vertical w-full gap-1 p-0">
			{#each links as link (link.href)}
				<li>
					<a
						href={link.href}
						class:menu-active={page.url.pathname === link.href}
						aria-current={page.url.pathname === link.href ? 'page' : undefined}>{link.label}</a
					>
				</li>
			{/each}
		</ul>
		<form method="POST" action={routes.logout()}>
			<button class="btn btn-ghost btn-sm justify-start">Salir</button>
		</form>
	</nav>
	<div class="flex min-w-0 flex-col gap-4">
		{#if !page.data.customer.verified}
			<div role="status" class="alert alert-warning flex-wrap">
				<span
					>Verifica tu correo para vincular a tu cuenta los pedidos que hiciste como invitado.</span
				>
				<form method="POST" action="{routes.account()}?/resend">
					<button class="btn btn-sm">Reenviar correo</button>
				</form>
			</div>
		{/if}
		{@render children()}
	</div>
</div>
