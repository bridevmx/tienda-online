import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Variables de entorno del servidor (SvelteKit 3: solo las declaradas aqui existen en
 * `$app/env/private`). Se leen al arrancar la app, no al compilar. Ver `.env.example`.
 */
const optional = (fallback) => (value) => (value === undefined || value === '' ? fallback : value);

export const variables = defineEnvVars({
	PB_URL: {
		schema: optional('http://127.0.0.1:8090'),
		description: 'URL interna de PocketBase (el navegador nunca la usa)'
	},
	PB_ADMIN_EMAIL: {
		schema: optional(''),
		description: 'Superusuario de PocketBase: pedidos, webhooks y lectura de ajustes'
	},
	PB_ADMIN_PASSWORD: { schema: optional(''), description: 'Contrasena del superusuario' },
	CLIP_API_URL: {
		schema: optional('https://api.payclip.com'),
		description: 'Base de la API de Clip (para pruebas se apunta a un doble)'
	},
	CLIP_API_TOKEN: {
		schema: optional(''),
		description:
			'Clip: valor del header Authorization (alternativa a CLIP_API_KEY y CLIP_API_SECRET)'
	},
	CLIP_API_KEY: { schema: optional(''), description: 'Credencial de Clip (usuario)' },
	CLIP_API_SECRET: { schema: optional(''), description: 'Credencial de Clip (secreto)' },
	CLIP_WEBHOOK_TOKEN: {
		schema: optional(''),
		description: 'Token secreto que va en la URL del webhook de Clip'
	}
});
