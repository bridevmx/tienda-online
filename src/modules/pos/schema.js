import { z } from 'zod';
import { recordId } from '#core/fields.js';
import { PAYMENT_METHODS } from '#core/pricing.js';

const jsonArray = (v) => {
	if (typeof v !== 'string') return v;
	try {
		return JSON.parse(v);
	} catch {
		return null;
	}
};

/** Cobro desde el TPV (formulario): el ticket viaja como JSON en un campo oculto. */
export const chargeSchema = z.object({
	lines: z.preprocess(
		jsonArray,
		z
			.array(
				z.object({
					variant: recordId('Producto no válido'),
					qty: z.number().int().min(1).max(99)
				}),
				{ error: 'El ticket está vacío' }
			)
			.min(1, 'El ticket está vacío')
	),
	method: z.enum(PAYMENT_METHODS, { error: 'Elige cómo cobrar' }),
	name: z.preprocess((v) => v ?? '', z.string().trim().max(120)),
	email: z.preprocess((v) => v ?? '', z.string().trim().toLowerCase().max(160)),
	/** Efectivo recibido en centavos (solo para el cambio del ticket; no se guarda). */
	received: z.preprocess(
		(v) => (v === '' || v == null ? 0 : Number(v)),
		z.number().int().min(0).max(100_000_000)
	)
});
