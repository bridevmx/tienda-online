<script>
	import { routes } from '#core/routes.js';

	let { data } = $props();
</script>

<svelte:head>
	<title>Mi cuenta</title>
</svelte:head>

<section class="card border border-current/10">
	<div class="card-body">
		<h1 class="card-title">Hola, {data.customer.name}</h1>
		<p>Aquí verás tus pedidos y su estatus (siguientes fases).</p>
		<form method="POST" action={routes.logout()} class="card-actions">
			<button class="btn btn-sm">Salir</button>
		</form>
	</div>
</section>
