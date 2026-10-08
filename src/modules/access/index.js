import { defineModule } from '#core/module.js';

/** Roles que trae el sistema. `admin` es `system`: recibe todos los permisos y no se edita en la app. */
export const SYSTEM_ROLES = [
	{ slug: 'admin', name: 'Administrador', system: true },
	{ slug: 'gerente', name: 'Gerente', system: false },
	{ slug: 'cajero', name: 'Cajero', system: false }
];

const perm = (code, description, roles = []) => ({ code, description, roles });

export default defineModule({
	name: 'access',
	label: 'Acceso',
	permissions: [
		perm('roles:read', 'Ver roles y permisos'),
		perm('roles:create', 'Crear roles'),
		perm('roles:update', 'Editar roles y sus permisos'),
		perm('roles:delete', 'Eliminar roles'),
		perm('users:read', 'Ver personal'),
		perm('users:create', 'Dar de alta personal'),
		perm('users:update', 'Editar personal, su rol y su estado'),
		perm('users:delete', 'Eliminar personal'),
		perm('customers:read', 'Ver clientes', ['gerente', 'cajero']),
		perm('customers:create', 'Crear clientes', ['gerente', 'cajero']),
		perm('customers:update', 'Editar clientes', ['gerente']),
		perm('customers:delete', 'Eliminar clientes')
	]
	// nav y resources llegan con el CRUD generico (fase 3)
});
