/** Estados de un pedido para mostrar: texto y color del tema (primary | secondary | info | error). */
export const ORDER_STATUS = {
	pending: { label: 'Pendiente de pago', badge: 'info' },
	paid: { label: 'Pagado', badge: 'primary' },
	completed: { label: 'Completado', badge: 'secondary' },
	cancelled: { label: 'Cancelado', badge: 'error' },
	refunded: { label: 'Reembolsado', badge: 'error' }
};

export const PAYMENT_STATUS = {
	pending: 'Pendiente',
	confirmed: 'Confirmado',
	failed: 'Fallido',
	refunded: 'Reembolsado'
};

export const METHOD_LABEL = {
	cash: 'Efectivo',
	transfer: 'Transferencia',
	card_clip: 'Tarjeta'
};

export const CHANNEL_LABEL = { web: 'Tienda web', pos: 'TPV' };

export const orderStatusView = (status) => ORDER_STATUS[status] ?? { label: status, badge: 'info' };

/** Transiciones permitidas entre estados (la regla vive aqui, no repartida por las acciones). */
export const TRANSITIONS = {
	pending: ['paid', 'cancelled'],
	paid: ['completed', 'refunded'],
	completed: ['refunded'],
	cancelled: [],
	refunded: []
};

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;
