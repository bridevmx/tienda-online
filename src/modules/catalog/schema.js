import { z } from 'zod';
import {
	checkbox,
	integer,
	nameField,
	optionalRecordId,
	optionalText,
	recordId,
	recordIdList,
	slugField,
	withSlug
} from '#core/fields.js';

/**
 * Esquemas del catalogo. Son la fuente de verdad: validan formularios, payloads al servicio y
 * (en la fase 3) generan los campos del CRUD del admin. Precios en CENTAVOS enteros.
 */
export const categorySchema = withSlug(
	z.object({
		name: nameField(120),
		slug: slugField(140),
		parent: optionalRecordId(),
		sort: integer({ min: 0 }),
		active: checkbox(true)
	})
);

export const productSchema = withSlug(
	z.object({
		name: nameField(200),
		slug: slugField(220),
		description: optionalText(100000),
		category: recordId('Selecciona una categoría'),
		active: checkbox(true)
	})
);

export const optionSchema = z.object({
	name: nameField(80),
	sort: integer({ min: 0 })
});

export const optionValueSchema = z.object({
	option: recordId('Selecciona una opción'),
	value: nameField(80),
	sort: integer({ min: 0 })
});

export const variantSchema = z.object({
	product: recordId('Selecciona un producto'),
	sku: z
		.string({ error: 'Escribe el SKU' })
		.trim()
		.toUpperCase()
		.regex(
			/^[A-Z0-9][A-Z0-9._-]{0,63}$/,
			'SKU inválido: letras, números, punto, guion o guion bajo'
		),
	barcode: optionalText(64),
	/** Centavos MXN. */
	price: integer({ min: 0, defaultValue: 0 }),
	stock: integer({ min: 0, defaultValue: 0 }),
	active: checkbox(true),
	/** Valores de opcion (ids de `option_values`), a lo mas uno por opcion. */
	values: recordIdList()
});
