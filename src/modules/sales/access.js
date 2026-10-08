import { tokenMatches } from '#core/tokens.js';

/**
 * Quien puede ver un pedido en /pedido/<codigo>: el personal con orders:read, el cliente dueno
 * (con sesion) o quien tenga el token del pedido (invitados). Cualquier otro caso: no existe.
 */
export function canViewOrder({ order, token, customerId, permissions }) {
	if (permissions?.has('orders:read')) return true;
	if (customerId && order.customer && order.customer === customerId) return true;
	return tokenMatches(token ?? '', order.access_token);
}
