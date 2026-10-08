<script>
	import { page } from '$app/state';
	import ThemeSwitcher from '#ui/ThemeSwitcher.svelte';
	import { routes } from '#core/routes.js';

	let { children } = $props();
	const data = $derived(page.data);
	const year = new Date().getFullYear();
</script>

<div class="flex min-h-screen flex-col">
	<header class="border-b border-current/10">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
			<a class="text-xl font-semibold" href={routes.home()}>{data.storeName}</a>

			<form
				method="GET"
				action={routes.products()}
				class="order-3 w-full sm:order-none sm:ml-4 sm:w-auto sm:flex-1"
				role="search"
			>
				<label class="input w-full sm:max-w-md">
					<input
						type="search"
						name="q"
						placeholder="Buscar productos…"
						aria-label="Buscar productos"
					/>
				</label>
			</form>

			<nav class="ml-auto flex items-center gap-1" aria-label="Cuenta y carrito">
				<ThemeSwitcher current={data.theme} />
				{#if data.account}
					<a class="btn btn-ghost btn-sm" href={routes.account()}>{data.account.name}</a>
				{:else}
					<a class="btn btn-ghost btn-sm" href={routes.login()}>Entrar</a>
				{/if}
				<a
					class="btn btn-sm"
					href={routes.cart()}
					aria-label={`Carrito, ${data.cartCount} artículos`}
				>
					Carrito
					<span class="badge badge-sm badge-primary">{data.cartCount}</span>
				</a>
			</nav>
		</div>

		{#if data.categories.length}
			<nav class="border-t border-current/10" aria-label="Categorías">
				<ul class="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1 text-sm">
					<li><a class="btn btn-ghost btn-sm" href={routes.products()}>Todo</a></li>
					{#each data.categories as category (category.id)}
						<li>
							<a
								class="btn btn-ghost btn-sm whitespace-nowrap"
								class:btn-active={page.url.pathname === category.href}
								href={category.href}>{category.name}</a
							>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
	</header>

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="border-t border-current/10 px-4 py-6 text-sm">
		<div class="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 opacity-80">
			<span>© {year} {data.storeName}</span>
			<span class="flex flex-wrap gap-x-4">
				{#if data.contact?.email}<a class="link" href={`mailto:${data.contact.email}`}
						>{data.contact.email}</a
					>{/if}
				{#if data.contact?.phone}<a class="link" href={`tel:${data.contact.phone}`}
						>{data.contact.phone}</a
					>{/if}
			</span>
		</div>
	</footer>
</div>
