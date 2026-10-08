import { randomBytes } from 'node:crypto';

/** Ids de PocketBase: 15 caracteres [a-z0-9]. Se generan aqui para poder relacionar registros dentro de un batch. */
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newRecordId(bytes = randomBytes(15)) {
	return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

/** Sin 0/O/1/I para que se pueda dictar por telefono. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Codigo legible del pedido: W-20261008-K3F9X (W = web, P = punto de venta). */
export function orderCode(channel, date = new Date(), bytes = randomBytes(5)) {
	const day = date.toISOString().slice(0, 10).replaceAll('-', '');
	const rand = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
	return `${channel === 'pos' ? 'P' : 'W'}-${day}-${rand}`;
}

export const ORDER_CODE_PATTERN = /^[A-Z]-\d{8}-[A-Z0-9]{4,8}$/;

/** Token para consultar un pedido de invitado: 32 bytes aleatorios (no adivinable). */
export const newAccessToken = () => randomBytes(32).toString('base64url');

/** Fecha en el formato de PocketBase ("2026-10-08 05:04:54.960Z"). */
export const pbDate = (date) => date.toISOString().replace('T', ' ');
