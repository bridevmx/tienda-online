import { z } from 'zod';
import { SLUG_PATTERN, slugify } from './slug.js';

/**
 * Piezas de Zod para formularios HTML, donde todo llega como texto.
 * Reutilizables en cualquier modulo.
 */

/** Checkbox: el navegador manda "on" si esta marcado y nada si no. */
export const checkbox = (defaultValue = false) =>
	z.preprocess(
		(v) => (v === undefined ? defaultValue : v === true || v === 'on' || v === 'true' || v === '1'),
		z.boolean()
	);

/** Texto opcional: vacio o ausente -> ''. */
export const optionalText = (max = 255) =>
	z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(max));

/** Entero desde texto: '' o ausente -> el valor por defecto. */
export const integer = ({ min = 0, max = Number.MAX_SAFE_INTEGER, defaultValue = 0 } = {}) =>
	z.preprocess(
		(v) => (v === '' || v == null ? defaultValue : typeof v === 'string' ? Number(v) : v),
		z.number({ error: 'Escribe un número' }).int('Debe ser un número entero').min(min).max(max)
	);

/** Id de PocketBase (15 caracteres alfanumericos en minuscula). */
export const recordId = (message = 'Selecciona una opción') =>
	z.string({ error: message }).regex(/^[a-z0-9]{15}$/, message);

/** Id opcional: '' o ausente -> ''. */
export const optionalRecordId = () =>
	z.preprocess((v) => (v == null ? '' : v), z.union([z.literal(''), recordId()]));

/** Lista de ids; acepta un arreglo o varios campos con el mismo nombre. */
export const recordIdList = () =>
	z.preprocess(
		// un solo valor o un arreglo; se ignoran los vacios (p. ej. un select dejado en blanco)
		(v) => (v == null ? [] : (Array.isArray(v) ? v : [v]).filter((x) => x !== '')),
		z.array(recordId())
	);

/** Nombre visible: texto obligatorio de hasta `max` caracteres. */
export const nameField = (max) =>
	z.string({ error: 'Escribe un nombre' }).trim().min(1, 'Escribe un nombre').max(max);

/** Identificador de URL (slug) valido. */
export const slugField = (max) =>
	z
		.string({ error: 'Escribe un identificador' })
		.trim()
		.min(1, 'Escribe un identificador')
		.max(max)
		.regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones');

/** Si el slug viene vacio se genera desde el nombre antes de validar. */
export const withSlug = (schema) =>
	z.preprocess((raw) => {
		if (raw && typeof raw === 'object' && !String(raw.slug ?? '').trim()) {
			return { ...raw, slug: slugify(raw.name) };
		}
		return raw;
	}, schema);
