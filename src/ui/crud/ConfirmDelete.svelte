<script>
	import { enhance } from '$app/forms';

	/** Dialogo de confirmacion para eliminar. `target` = { id, title } o null; `action` = ruta del formulario. */
	let { target = $bindable(null), action = '?/delete', noun = 'este registro' } = $props();
	let dialog;

	$effect(() => {
		if (target) dialog?.showModal();
		else dialog?.close();
	});
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (target = null)}>
	<form
		method="POST"
		{action}
		class="modal-box"
		use:enhance={() =>
			async ({ update }) => {
				target = null;
				await update();
			}}
	>
		<h3 class="text-lg font-semibold">Eliminar {noun}</h3>
		<p class="py-4">
			¿Seguro que quieres eliminar <strong>{target?.title}</strong>? Esta acción no se puede
			deshacer.
		</p>
		<input type="hidden" name="id" value={target?.id ?? ''} />
		<div class="modal-action">
			<button type="button" class="btn" onclick={() => (target = null)}>Cancelar</button>
			<button class="btn btn-error">Eliminar</button>
		</div>
	</form>
	<form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
</dialog>
