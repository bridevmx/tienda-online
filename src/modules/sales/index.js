import { defineModule } from '#core/module.js';
import { routes } from '#core/routes.js';

const perm = (code, description, roles = []) => ({ code, description, roles });

export default defineModule({
	name: 'sales',
	label: 'Ventas',
	permissions: [
		perm('orders:read', 'Ver todas las ventas (web y TPV) y sus finanzas', ['gerente']),
		perm('orders:update', 'Marcar pedidos como completados', ['gerente']),
		perm('orders:cancel', 'Cancelar pedidos pendientes', ['gerente']),
		perm('orders:refund', 'Hacer devoluciones', ['gerente']),
		perm('payments:confirm', 'Confirmar pagos por transferencia', ['gerente']),
		perm('pos:use', 'Usar el punto de venta (TPV) y ver sus propias ventas', ['gerente', 'cajero'])
	],
	nav: [
		{ label: 'Ventas', href: routes.admin.sales(), permission: 'orders:read' },
		{ label: 'Abrir TPV', href: routes.pos.home(), permission: 'pos:use' }
	]
});
