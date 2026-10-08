/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 7: correos de la cuenta del cliente (verificacion, recuperar contrasena, cambio de correo).
 * Solo plantillas: los enlaces apuntan a rutas de la tienda (SvelteKit), no al panel de PocketBase.
 * `{APP_URL}` sale de Ajustes > Application > URL de PocketBase: debe ser la URL publica de la TIENDA.
 */
const body = (text, path, label) =>
	`<p>Hola,</p><p>${text}</p><p><a class="btn" href="{APP_URL}${path}" target="_blank" rel="noopener">${label}</a></p>` +
	'<p><small>Si no fuiste tú, puedes ignorar este correo.</small></p>';

migrate(
	(app) => {
		const customers = app.findCollectionByNameOrId('customers');
		customers.verificationTemplate = {
			subject: 'Verifica tu correo en {APP_NAME}',
			body: body(
				'Confirma tu correo para vincular tus pedidos a tu cuenta.',
				'/verificar/{TOKEN}',
				'Verificar correo'
			)
		};
		customers.resetPasswordTemplate = {
			subject: 'Restablece tu contraseña de {APP_NAME}',
			body: body(
				'Recibimos una solicitud para restablecer tu contraseña.',
				'/recuperar/{TOKEN}',
				'Elegir nueva contraseña'
			)
		};
		customers.confirmEmailChangeTemplate = {
			subject: 'Confirma tu nuevo correo en {APP_NAME}',
			body: body(
				'Confirma que quieres usar este correo en tu cuenta.',
				'/correo/{TOKEN}',
				'Confirmar correo'
			)
		};
		app.save(customers);
	},
	() => {
		// las plantillas anteriores eran las de fabrica; no hace falta restaurarlas
	}
);
