import { defineModule } from '#core/module.js';
import { resources } from './resources.js';

const RESOURCES = [
	{ name: 'categories', label: 'categorías' },
	{ name: 'products', label: 'productos' },
	{ name: 'options', label: 'opciones (talla, color…) y sus valores' },
	{ name: 'variants', label: 'variantes (precio, stock, SKU)' }
];

/** Lectura para gerente y cajero; el resto, solo gerente (admin recibe todo). */
const permissionsFor = ({ name, label }) => [
	{
		code: `${name}:read`,
		description: `Ver ${label} (incluye inactivos)`,
		roles: ['gerente', 'cajero']
	},
	{ code: `${name}:create`, description: `Crear ${label}`, roles: ['gerente'] },
	{ code: `${name}:update`, description: `Editar ${label}`, roles: ['gerente'] },
	{ code: `${name}:delete`, description: `Eliminar ${label}`, roles: ['gerente'] }
];

export default defineModule({
	name: 'catalog',
	label: 'Catálogo',
	permissions: RESOURCES.flatMap(permissionsFor),
	resources
});
