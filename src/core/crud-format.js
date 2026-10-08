import { formatDate } from './dates.js';
import { formatMoney } from './money.js';
import { routes } from './routes.js';

/** Stock a partir del cual se avisa "pocas piezas". */
export const LOW_STOCK = 5;

const text = (value) => (value == null ? '' : String(value));

/**
 * Celda de la tabla ya lista para pintar: { type, text, badge?, src?, muted? }.
 * `badge` es uno de los 4 colores del tema: primary | secondary | info | error.
 */
export function formatCell(column, record, collection) {
	const value = record[column.key];
	switch (column.type) {
		case 'code':
			return { type: 'text', text: text(value), mono: true };
		case 'muted':
			return { type: 'text', text: text(value), muted: true };
		case 'bool': {
			const [yes, no] = column.labels ?? ['Sí', 'No'];
			const label = value ? yes : no;
			return { type: 'badge', text: label, badge: value ? 'primary' : null };
		}
		case 'money':
			return { type: 'text', text: formatMoney(Number(value) || 0), align: 'end' };
		case 'integer':
			return { type: 'text', text: text(value), align: 'end' };
		case 'stock': {
			const n = Number(value) || 0;
			if (n <= 0) return { type: 'badge', text: 'Agotado', badge: 'error' };
			return { type: 'badge', text: String(n), badge: n <= LOW_STOCK ? 'info' : null };
		}
		case 'relation':
			return { type: 'text', text: text(record.expand?.[column.key]?.[column.labelKey ?? 'name']) };
		case 'relations': {
			const list = record.expand?.[column.key] ?? [];
			return { type: 'text', text: list.map((r) => r[column.labelKey ?? 'name']).join(' / ') };
		}
		case 'count':
			return { type: 'text', text: String(Array.isArray(value) ? value.length : 0), align: 'end' };
		case 'date':
			return { type: 'text', text: formatDate(value), muted: true };
		case 'image': {
			const file = Array.isArray(value) ? value[0] : value;
			return {
				type: 'image',
				src: file ? routes.media(collection, record.id, file, column.thumb ?? '160x160') : null
			};
		}
		default:
			return { type: 'text', text: text(value) };
	}
}
