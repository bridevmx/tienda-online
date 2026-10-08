import { defineResource } from '#core/resource.js';
import { roleSchema } from './schema.js';

export const roles = defineResource({
	name: 'roles',
	label: ['Rol', 'Roles'],
	permissions: {
		read: 'roles:read',
		create: 'roles:create',
		update: 'roles:update',
		delete: 'roles:delete'
	},
	schema: roleSchema,
	columns: [
		{ key: 'name', label: 'Nombre', sortable: true },
		{ key: 'slug', label: 'Identificador', type: 'muted' },
		{ key: 'system', label: 'Tipo', type: 'bool', labels: ['Sistema', ''] },
		{ key: 'permissions', label: 'Permisos', type: 'count' }
	],
	fields: [
		{ name: 'name', label: 'Nombre', type: 'text', required: true },
		{
			name: 'slug',
			label: 'Identificador',
			type: 'text',
			help: 'Déjalo vacío para generarlo del nombre.'
		},
		{
			name: 'permissions',
			label: 'Permisos',
			type: 'relations',
			options: {
				collection: 'permissions',
				sort: 'module,code',
				label: (r) => r.description || r.code,
				hint: (r) => r.code,
				group: (r, ctx) => ({ key: r.module, label: ctx?.moduleLabels?.get(r.module) ?? r.module })
			}
		}
	],
	search: ['name', 'slug'],
	defaultSort: 'name',
	// los roles `system` (admin) los mantiene `npm run permissions:sync`, no la app
	canEdit: (role) => !role.system,
	canDelete: (role) => !role.system
});

export const resources = [roles];
