<script>
	/** Formulario de acceso compartido por personal y clientes. `form` es el resultado de la accion. */
	let { title, form, enhance, children } = $props();
</script>

<section class="mx-auto max-w-sm">
	<form method="POST" use:enhance class="card border border-current/10">
		<div class="card-body gap-3">
			<h1 class="card-title">{title}</h1>

			{#if form?.errors?._}
				<div role="alert" class="alert alert-error">{form.errors._}</div>
			{/if}

			<label class="flex flex-col gap-1">
				<span class="text-sm">Correo</span>
				<input
					class="input w-full"
					class:input-error={form?.errors?.email}
					type="email"
					name="email"
					autocomplete="username"
					value={form?.values?.email ?? ''}
					required
				/>
				{#if form?.errors?.email}<span class="text-error text-sm">{form.errors.email}</span>{/if}
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-sm">Contraseña</span>
				<input
					class="input w-full"
					class:input-error={form?.errors?.password}
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/>
				{#if form?.errors?.password}<span class="text-error text-sm">{form.errors.password}</span>
				{/if}
			</label>

			<button class="btn btn-primary">Entrar</button>
			{@render children?.()}
		</div>
	</form>
</section>
