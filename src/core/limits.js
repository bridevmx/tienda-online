import { createRateLimiter } from './rate-limit.js';

/** Intentos fallidos de acceso (por IP y por correo). */
export const loginFailures = createRateLimiter({ max: 8, windowMs: 10 * 60_000 });
/** Acciones que envian correo o crean cuentas (registro, recuperar, reenviar verificacion). */
export const mailActions = createRateLimiter({ max: 5, windowMs: 15 * 60_000 });

/** Webhook publico de Clip (por IP): evita que se use para gastar llamadas a Clip. */
export const webhookHits = createRateLimiter({ max: 120, windowMs: 60_000 });

export const TOO_MANY = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';

/**
 * IP del visitante para las llaves del limitador. `getClientAddress()` lanza si el servidor se
 * configuro con ADDRESS_HEADER y la solicitud no la trae (p. ej. sin proxy): no debe tumbar el
 * acceso, asi que se cae a una llave comun.
 */
export function clientKey(getClientAddress) {
	try {
		return getClientAddress();
	} catch {
		return 'unknown';
	}
}
