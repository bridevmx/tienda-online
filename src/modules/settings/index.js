import { defineModule } from '#core/module.js';
import { routes } from '#core/routes.js';

export default defineModule({
	name: 'settings',
	label: 'Configuración',
	// solo admin los recibe: incluyen la comision de Clip
	permissions: [
		{ code: 'settings:read', description: 'Ver los ajustes de la tienda' },
		{ code: 'settings:update', description: 'Cambiar los ajustes de la tienda' }
	],
	nav: [{ label: 'Ajustes', href: routes.admin.settings(), permission: 'settings:read' }]
});
