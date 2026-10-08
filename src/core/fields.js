import { z } from 'zod';

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
		(v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]),
		z.array(recordId())
	);
