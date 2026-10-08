import { createRateLimiter } from './rate-limit.js';

/** Intentos fallidos de acceso (por IP y por correo). */
export const loginFailures = createRateLimiter({ max: 8, windowMs: 10 * 60_000 });
/** Acciones que envian correo o crean cuentas (registro, recuperar, reenviar verificacion). */
export const mailActions = createRateLimiter({ max: 5, windowMs: 15 * 60_000 });

export const TOO_MANY = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
