<script>
	import { enhance } from '$app/forms';
	import Field from '#ui/Field.svelte';

	let { data, form } = $props();
	const errorsFor = (section) => (form?.section === section ? (form?.errors ?? {}) : {});
	const valuesFor = (section, fallback) => (form?.section === section ? form.values : fallback);
</script>

<svelte:head>
	<title>Mis datos</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1 class="text-2xl font-semibold">Mis datos</h1>

<form method="POST" action="?/profile" use:enhance class="card border border-current/10">
	<div class="card-body gap-3">
		<h2 class="card-title text-lg">Perfil</h2>
		<Field
			name="name"
			label="Nombre"
			value={valuesFor('profile', data.profile)?.name}
			errors={errorsFor('profile')}
			autocomplete="name"
			required
		/>
		<Field
			name="phone"
			label="Teléfono"
			type="tel"
			value={valuesFor('profile', data.profile)?.phone}
			errors={errorsFor('profile')}
			autocomplete="tel"
		/>
		<button class="btn btn-primary btn-sm self-start">Guardar</button>
	</div>
</form>

<form method="POST" action="?/email" use:enhance class="card border border-current/10">
	<div class="card-body gap-3">
		<h2 class="card-title text-lg">Correo</h2>
		<p class="text-sm opacity-70">
			Hoy: {data.profile.email}. Te pediremos confirmar el nuevo correo.
		</p>
		{#if errorsFor('email')._}<div role="alert" class="alert alert-error">
				{errorsFor('email')._}
			</div>{/if}
		<Field
			name="email"
			label="Nuevo correo"
			type="email"
			value={valuesFor('email', {})?.email}
			errors={errorsFor('email')}
			autocomplete="email"
			required
		/>
		<button class="btn btn-sm self-start">Cambiar correo</button>
	</div>
</form>

<form method="POST" action="?/password" use:enhance class="card border border-current/10">
	<div class="card-body gap-3">
		<h2 class="card-title text-lg">Contraseña</h2>
		<Field
			name="oldPassword"
			label="Contraseña actual"
			type="password"
			errors={errorsFor('password')}
			autocomplete="current-password"
			required
		/>
		<Field
			name="password"
			label="Nueva contraseña"
			type="password"
			errors={errorsFor('password')}
			autocomplete="new-password"
			hint="Mínimo 8 caracteres"
			required
			minlength={8}
		/>
		<Field
			name="passwordConfirm"
			label="Repite la nueva contraseña"
			type="password"
			errors={errorsFor('password')}
			autocomplete="new-password"
			required
		/>
		<button class="btn btn-sm self-start">Cambiar contraseña</button>
	</div>
</form>
