<script>
	import { routes } from '#core/routes.js';

	let { data, children } = $props();
</script>

<div class="flex items-center justify-between gap-4 pb-4">
	<a class="font-semibold" href={routes.admin.home()}>Administración</a>
	<div class="flex items-center gap-3 text-sm">
		<span>{data.user.name || data.user.email}</span>
		{#if data.user.role}<span class="badge badge-info">{data.user.role.name}</span>{/if}
		<form method="POST" action={routes.admin.logout()}>
			<button class="btn btn-sm">Salir</button>
		</form>
	</div>
</div>

{@render children()}
