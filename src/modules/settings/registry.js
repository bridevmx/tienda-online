import { z } from 'zod';
import { toCents } from '#core/money.js';

/**
 * Registro de ajustes: la fuente de verdad de que claves existen, su tipo, su valor por defecto y
 * como se validan. En la base se guarda solo `key` y `value` (texto); aqui se decide que significa.
 *
 * Tipos: boolean, percent (2.9 = 2.9 %), money (pesos en el formulario, centavos al guardar),
 * integer, text, textarea.
 */
export const GROUPS = [
	{
		id: 'store',
		title: 'Tienda',
		description: 'Datos que se muestran a tus clientes.'
	},
	{
		id: 'tax',
		title: 'Impuestos',
		description:
			'Los precios que guardas en el catálogo son SIN IVA. Con esta opción activa, el IVA se suma a todos los productos y el cliente lo ve desglosado.'
	},
	{
		id: 'clip',
		title: 'Pagos con tarjeta (Clip)',
		description:
			'Para recibir en neto el precio que guardaste, la comisión de Clip (y su IVA) se integra en el precio. El cliente NUNCA ve la comisión: quien paga en efectivo o transferencia recibe un descuento equivalente. Cambia la tasa cuando Clip modifique tus condiciones (promociones, etc.).'
	},
	{
		id: 'orders',
		title: 'Pedidos',
		description: 'Los pedidos pendientes reservan stock hasta que se paguen o venzan.'
	},
	{
		id: 'transfer',
		title: 'Transferencia bancaria',
		description: 'Se muestran al cliente que elige pagar por transferencia.'
	}
];

export const SETTINGS = [
	{
		key: 'store.name',
		group: 'store',
		type: 'text',
		label: 'Nombre de la tienda',
		default: 'Tienda online',
		max: 80,
		required: true
	},
	{
		key: 'store.contact_email',
		group: 'store',
		type: 'text',
		label: 'Correo de contacto',
		default: '',
		max: 120
	},
	{
		key: 'store.contact_phone',
		group: 'store',
		type: 'text',
		label: 'Teléfono de contacto',
		default: '',
		max: 30
	},

	{
		key: 'tax.apply_iva',
		group: 'tax',
		type: 'boolean',
		label: 'Aplicar IVA a todos los productos',
		help: 'Los precios del catálogo no incluyen IVA; se agrega al cobrar.',
		default: true
	},
	{ key: 'tax.iva_rate', group: 'tax', type: 'percent', label: 'Tasa de IVA', default: 16 },

	{
		key: 'clip.apply_fee',
		group: 'clip',
		type: 'boolean',
		label: 'Incluir la comisión de Clip en los precios',
		help: 'El cliente no ve la comisión: queda dentro del precio.',
		default: false
	},
	{
		key: 'clip.fee_rate',
		group: 'clip',
		type: 'percent',
		label: 'Comisión de Clip (%)',
		help: 'Sin IVA; el IVA de la comisión se agrega solo.',
		default: 2.9
	},
	{
		key: 'clip.fee_fixed',
		group: 'clip',
		type: 'money',
		label: 'Cargo fijo por transacción (MXN)',
		help: 'Sin IVA. Déjalo en 0 si Clip no cobra cargo fijo.',
		default: 0
	},
	{
		key: 'pricing.discount_non_card',
		group: 'clip',
		type: 'boolean',
		label: 'Descuento por pagar en efectivo o transferencia',
		help: 'Si la comisión está incluida en el precio, quien no paga con tarjeta recibe un descuento igual a esa comisión. Apagado: el precio es único para todos los métodos.',
		default: true
	},

	{
		key: 'orders.pending_ttl_hours',
		group: 'orders',
		type: 'integer',
		label: 'Horas para pagar un pedido pendiente',
		help: 'Pasado ese tiempo el pedido se cancela y el stock se libera.',
		default: 24,
		min: 1,
		max: 720
	},

	{
		key: 'transfer.beneficiary',
		group: 'transfer',
		type: 'text',
		label: 'Beneficiario',
		default: '',
		max: 120
	},
	{ key: 'transfer.bank', group: 'transfer', type: 'text', label: 'Banco', default: '', max: 80 },
	{
		key: 'transfer.clabe',
		group: 'transfer',
		type: 'text',
		label: 'CLABE interbancaria',
		help: '18 dígitos.',
		default: '',
		max: 18,
		pattern: /^(\d{18})?$/,
		patternMessage: 'La CLABE debe tener 18 dígitos'
	},
	{
		key: 'transfer.instructions',
		group: 'transfer',
		type: 'textarea',
		label: 'Instrucciones',
		help: 'Por ejemplo: "Envía tu comprobante por WhatsApp".',
		default: '',
		max: 500
	}
];

export const SETTINGS_BY_KEY = new Map(SETTINGS.map((s) => [s.key, s]));

const BOOLEAN_TRUE = new Set(['on', 'true', '1', true]);
const BOOLEAN_FALSE = new Set(['off', 'false', '0', false]);

/** Valida el valor que llega de un formulario y lo devuelve como TEXTO canonico para guardar. */
export function encodeSetting(def, input) {
	const text = typeof input === 'string' ? input.trim() : input;
	switch (def.type) {
		case 'boolean': {
			if (BOOLEAN_TRUE.has(text)) return 'true';
			if (BOOLEAN_FALSE.has(text)) return 'false';
			throw new Error('Valor no válido');
		}
		case 'percent': {
			if (!/^\d{1,3}([.,]\d{1,2})?$/.test(String(text))) {
				throw new Error('Escribe un porcentaje, por ejemplo 2.9 (máximo 2 decimales)');
			}
			const n = Number(String(text).replace(',', '.'));
			if (n < 0 || n > 100) throw new Error('El porcentaje debe estar entre 0 y 100');
			return String(n);
		}
		case 'money': {
			const cents = text === '' ? 0 : toCents(String(text));
			if (!Number.isInteger(cents) || cents < 0) throw new Error('Escribe un monto válido');
			return String(cents);
		}
		case 'integer': {
			const n = Number(text);
			if (text === '' || !Number.isInteger(n)) throw new Error('Escribe un número entero');
			if (n < (def.min ?? 0) || n > (def.max ?? Number.MAX_SAFE_INTEGER)) {
				throw new Error(`Debe estar entre ${def.min ?? 0} y ${def.max}`);
			}
			return String(n);
		}
		default: {
			const value = String(text ?? '');
			if (def.required && value === '') throw new Error('Este campo es obligatorio');
			if (def.max && value.length > def.max) throw new Error(`Máximo ${def.max} caracteres`);
			if (def.pattern && !def.pattern.test(value))
				throw new Error(def.patternMessage ?? 'Formato no válido');
			return value;
		}
	}
}

/** Texto guardado -> valor tipado (boolean, numero, texto). Si esta vacio o corrupto, el valor por defecto. */
export function decodeSetting(def, stored) {
	if (stored === undefined || stored === null) return def.default;
	switch (def.type) {
		case 'boolean':
			return stored === 'true' ? true : stored === 'false' ? false : def.default;
		case 'percent': {
			const n = Number(stored);
			return Number.isFinite(n) ? n : def.default;
		}
		case 'money':
		case 'integer': {
			const n = Number(stored);
			return Number.isInteger(n) ? n : def.default;
		}
		default:
			return String(stored);
	}
}

/** Valor tipado -> texto para el formulario (dinero en pesos). */
export function toFormValue(def, value) {
	switch (def.type) {
		case 'boolean':
			return !!value;
		case 'money':
			return (Number(value) / 100).toFixed(2);
		default:
			return String(value ?? '');
	}
}

/** Esquema Zod de TODO el formulario de ajustes (una entrada por clave presente). */
export const settingsFormSchema = z.record(z.string(), z.unknown()).transform((input, ctx) => {
	const out = {};
	for (const def of SETTINGS) {
		const raw =
			def.type === 'boolean' ? (def.key in input ? input[def.key] : 'off') : input[def.key];
		if (raw === undefined) continue; // clave ausente: no se toca
		try {
			out[def.key] = encodeSetting(def, raw);
		} catch (err) {
			ctx.addIssue({ code: 'custom', path: [def.key], message: err.message });
		}
	}
	return out;
});
