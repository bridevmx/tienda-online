import { z } from 'zod';
import {
	checkbox,
	integer,
	optionalRecordId,
	optionalText,
	recordId,
	recordIdList
} from '#core/fields.js';
import { SLUG_PATTERN, slugify } from '#core/slug.js';

/**
 * Esquemas del catalogo. Son la fuente de verdad: validan formularios, payloads al servicio y
 * (en la fase 3) generan los campos del CRUD del admin. Precios en CENTAVOS enteros.
 */
const name = (max) =>
	z.string({ error: 'Escribe un nombre' }).trim().min(1, 'Escribe un nombre').max(max);

/** Si el slug viene vacio se genera desde el nombre. */
const withSlug = (schema) =>
	z.preprocess((raw) => {
		if (raw && typeof raw === 'object' && !String(raw.slug ?? '').trim()) {
			return { ...raw, slug: slugify(raw.name) };
		}
		return raw;
	}, schema);

const slug = (max) =>
	z
		.string({ error: 'Escribe un identificador' })
		.trim()
		.min(1, 'Escribe un identificador')
		.max(max)
		.regex(SLUG_PATTERN, 'Solo minúsculas, números y guiones');

export const categorySchema = withSlug(
	z.object({
		name: name(120),
		slug: slug(140),
		parent: optionalRecordId(),
		sort: integer({ min: 0 }),
		active: checkbox(true)
	})
);

export const productSchema = withSlug(
	z.object({
		name: name(200),
		slug: slug(220),
		description: optionalText(100000),
		category: recordId('Selecciona una categoría'),
		active: checkbox(true)
	})
);

export const optionSchema = z.object({
	name: name(80),
	sort: integer({ min: 0 })
});

export const optionValueSchema = z.object({
	option: recordId('Selecciona una opción'),
	value: name(80),
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
