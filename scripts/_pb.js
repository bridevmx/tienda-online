import { getAdminPb } from '#core/pb-admin.js';

/** Cliente de superusuario para scripts, con las variables de .env (ver .env.example). */
export function scriptPb() {
	return getAdminPb({
		url: process.env.PB_URL || 'http://127.0.0.1:8090',
		email: process.env.PB_ADMIN_EMAIL,
		password: process.env.PB_ADMIN_PASSWORD
	});
}
