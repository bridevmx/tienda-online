import { z } from 'zod';
import { optionalRecordId, recordId } from '#core/fields.js';
import { PAYMENT_METHODS } from '#core/pricing.js';

const lineSchema = z.object({
	variant: recordId('Producto no válido'),
	qty: z
		.number({ error: 'Cantidad no válida' })
		.int()
		.min(1, 'La cantidad mínima es 1')
		.max(99, 'La cantidad máxima es 99')
});

/** Datos de contacto del comprador (checkout web). */
export const contactSchema = z.object({
	name: z.string({ error: 'Escribe tu nombre' }).trim().min(2, 'Escribe tu nombre').max(120),
	email: z
		.string({ error: 'Escribe tu correo' })
		.trim()
		.toLowerCase()
		.pipe(z.email({ error: 'Escribe un correo válido' }))
		.pipe(z.string().max(160)),
	phone: z
		.preprocess((v) => (v == null ? '' : v), z.string().trim().max(30))
		.refine((v) => v === '' || /^[+\d][\d\s().-]{6,28}$/.test(v), 'Escribe un teléfono válido')
});

/** Contacto en bruto; la validacion fina depende del canal (ver superRefine de placeOrderSchema). */
const rawContact = z.object({
	name: z.string().trim().max(120).default(''),
	email: z.string().trim().toLowerCase().max(160).default(''),
	phone: z.string().trim().max(30).default('')
});

export const placeOrderSchema = z
	.object({
		channel: z.enum(['web', 'pos']),
		method: z.enum(PAYMENT_METHODS, { error: 'Elige cómo quieres pagar' }),
		lines: z
			.array(lineSchema)
			.min(1, 'Tu carrito está vacío')
			.max(40)
			.refine(
				(lines) => new Set(lines.map((l) => l.variant)).size === lines.length,
				'Hay productos repetidos'
			),
		contact: rawContact,
		customerId: optionalRecordId(),
		createdBy: optionalRecordId(),
		/** TPV: efectivo y transferencia se cobran al momento (el pedido nace pagado). */
		confirmNow: z.boolean().default(false),
		/** Origen publico de la tienda (para los enlaces de retorno y el webhook de Clip). */
		origin: z.url()
	})
	.superRefine((order, ctx) => {
		const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
		if (order.channel === 'web') {
			if (order.method === 'cash') issue(['method'], 'El efectivo solo está disponible en tienda');
			if (order.confirmNow) issue(['confirmNow'], 'Un pedido web no se puede cobrar al momento');
			const contact = contactSchema.safeParse(order.contact);
			if (!contact.success) {
				for (const i of contact.error.issues) issue(['contact', ...i.path], i.message);
			}
		} else {
			// en el TPV el contacto es opcional, pero si hay correo debe ser valido
			if (order.contact.email && !z.email().safeParse(order.contact.email).success) {
				issue(['contact', 'email'], 'Escribe un correo válido');
			}
			if (!order.createdBy) issue(['createdBy'], 'Falta el cajero');
			if (order.confirmNow && order.method === 'card_clip')
				issue(['confirmNow'], 'La tarjeta se confirma por Clip');
			if (order.method === 'cash' && !order.confirmNow)
				issue(['confirmNow'], 'El efectivo se cobra al momento');
		}
	});
