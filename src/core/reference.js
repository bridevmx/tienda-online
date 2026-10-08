import { createHmac } from 'node:crypto';
import { tokenMatches } from './tokens.js';

/**
 * Referencia propia de un pago (la que se manda a Clip en `metadata.external_reference`, maximo 36
 * caracteres): `TDA-<id del pago>-<firma>`. La firma (HMAC) no es seguridad frente a Clip: sirve para
 * descartar referencias inventadas sin tocar la base ni llamar a nadie. Se compara en tiempo constante.
 */
const PREFIX = 'TDA';
const SIGNATURE_LENGTH = 8;
const PATTERN = /^TDA-([a-z0-9]{15})-([A-Za-z0-9]{8})$/;

const sign = (secret, body) =>
	createHmac('sha256', secret)
		.update(`payref:v1:${body}`)
		.digest('base64url')
		.replace(/[-_]/g, 'x')
		.slice(0, SIGNATURE_LENGTH);

/** Referencia del pago `paymentId` (id de registro de PocketBase: 15 caracteres a-z0-9). */
export function makePaymentReference(secret, paymentId) {
	if (!secret) throw new Error('Falta el secreto para firmar la referencia');
	if (!/^[a-z0-9]{15}$/.test(paymentId)) throw new TypeError('Id de pago no valido');
	return `${PREFIX}-${paymentId}-${sign(secret, paymentId)}`;
}

/** Id del pago si la referencia es nuestra (formato y firma validos); si no, null. */
export function parsePaymentReference(secret, reference) {
	const match = PATTERN.exec(String(reference ?? ''));
	if (!match || !secret) return null;
	return tokenMatches(match[2], sign(secret, match[1])) ? match[1] : null;
}
