import { DomainError } from '#core/errors.js';

/**
 * Reglas de integridad del catalogo que PocketBase no puede expresar. Son funciones puras: el
 * servicio les pasa los datos ya leidos y ellas deciden.
 */

/**
 * Una variante no repite opcion (no puede ser Talla M y Talla L a la vez) y todas las variantes de
 * un producto usan el mismo conjunto de opciones (si una es Talla+Color, las demas tambien; un
 * producto simple tiene una unica variante sin valores).
 *
 * @param {string[]} optionIds    opcion de cada valor elegido para esta variante
 * @param {string[][]} siblingSets conjuntos de opciones de las otras variantes del producto
 */
export function checkVariantOptions(optionIds, siblingSets) {
	if (new Set(optionIds).size !== optionIds.length) {
		throw new DomainError('Una variante no puede tener dos valores de la misma opción', {
			field: 'values'
		});
	}
	const mine = [...optionIds].sort().join(',');
	for (const set of siblingSets) {
		if ([...new Set(set)].sort().join(',') !== mine) {
			throw new DomainError('Todas las variantes del producto deben usar las mismas opciones', {
				field: 'values'
			});
		}
	}
}

/**
 * Las categorias tienen un solo nivel de subcategorias (raiz -> hija).
 * @param {{ id?: string, parentId: string, parent?: {id: string, parent?: string} | null, hasChildren?: boolean }} input
 */
export function checkCategoryParent({ id, parentId, parent, hasChildren = false }) {
	if (!parentId) return;
	if (id && parentId === id) {
		throw new DomainError('Una categoría no puede ser su propio padre', { field: 'parent' });
	}
	if (!parent) throw new DomainError('La categoría padre no existe', { field: 'parent' });
	if (parent.parent) {
		throw new DomainError('Solo se permite un nivel de subcategorías', { field: 'parent' });
	}
	if (hasChildren) {
		throw new DomainError('Una categoría con subcategorías no puede tener padre', {
			field: 'parent'
		});
	}
}
