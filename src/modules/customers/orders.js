import { routes } from '#core/routes.js';
import { METHOD_LABEL, orderStatusView } from '#modules/sales/status.js';

const PER_PAGE = 10;

/**
 * Pedidos del cliente en tarjetas. Se lee con el PocketBase DEL CLIENTE: las reglas de la base
 * garantizan que solo ve los suyos. Solo se arman campos de cliente (nada de finanzas).
 */
export async function listCustomerOrders(pb, customerId, page = 1) {
	const list = await pb.collection('orders').getList(page, PER_PAGE, {
		filter: pb.filter('customer = {:id}', { id: customerId }),
		sort: '-created'
	});
	const ids = list.items.map((o) => o.id);
	const items = ids.length
		? await pb.collection('order_items').getFullList({
				filter: pb.filter(
					ids.map((_, i) => `order = {:o${i}}`).join(' || '),
					Object.fromEntries(ids.map((id, i) => [`o${i}`, id]))
				),
				sort: 'created'
			})
		: [];
	return {
		page: list.page,
		totalPages: list.totalPages,
		totalItems: list.totalItems,
		orders: list.items.map((o) =>
			toOrderCard(
				o,
				items.filter((i) => i.order === o.id)
			)
		)
	};
}

/** Tarjeta de pedido: lo minimo para reconocerlo y saber que sigue. */
export function toOrderCard(order, items) {
	const status = orderStatusView(order.status);
	const names = items.map((i) =>
		i.quantity > 1 ? `${i.quantity} × ${i.product_name}` : i.product_name
	);
	return {
		code: order.code,
		createdAt: order.created,
		statusLabel: status.label,
		statusBadge: status.badge,
		pending: order.status === 'pending',
		total: order.total,
		methodLabel: METHOD_LABEL[order.payment_method] ?? order.payment_method,
		summary: names.slice(0, 3),
		more: Math.max(0, names.length - 3),
		href: routes.order(order.code)
	};
}

/**
 * Vincula a la cuenta los pedidos hechos como invitado con el mismo correo. Solo para correos YA
 * verificados (si no, cualquiera podria registrarse con el correo de otro y ver sus pedidos).
 * Escribe con superusuario.
 */
export async function linkGuestOrders(adminPb, customer) {
	if (!customer?.verified || !customer.email) return 0;
	const guest = await adminPb.collection('orders').getFullList({
		filter: adminPb.filter('customer = "" && contact_email = {:email}', {
			email: customer.email.toLowerCase()
		}),
		fields: 'id'
	});
	for (const { id } of guest)
		await adminPb.collection('orders').update(id, { customer: customer.id });
	return guest.length;
}
