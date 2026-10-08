import { toCents } from './money.js';

/**
 * Puente entre un <form> HTML y el schema del recurso.
 *   formulario -> input del schema:  toInput
 *   registro   -> valores del formulario: toFormValues
 */

const FILE_TYPES = new Set(['image', 'images']);

export const fileFields = (resource) => resource.fields.filter((f) => FILE_TYPES.has(f.type));

/**
 * `raw` es el objeto del formulario (formDataToObject). Aqui se resuelven las dos cosas que HTML
 * hace distinto: un checkbox sin marcar no se envia (-> 'off', no "usa el valor por defecto") y el
 * dinero se escribe en pesos (-> centavos enteros).
 */
export function toInput(resource, raw) {
	const input = { ...raw };
	for (const field of resource.fields) {
		if (field.type === 'checkbox') {
			input[field.name] = raw[field.name] === undefined ? 'off' : raw[field.name];
		} else if (field.type === 'money') {
			const text = String(raw[field.name] ?? '').trim();
			if (text === '') continue;
			try {
				input[field.name] = String(toCents(text));
			} catch {
				// no es un numero: se deja tal cual para que el schema lo rechace con su mensaje
			}
		}
	}
	return input;
}

/** Valores iniciales de un formulario a partir de un registro (o de los valores por defecto al crear). */
export function toFormValues(resource, record = {}) {
	const values = {};
	const files = {};
	for (const field of resource.fields) {
		const value = record[field.name];
		switch (field.type) {
			case 'checkbox':
				values[field.name] = value === undefined ? true : !!value;
				break;
			case 'money':
				values[field.name] = value == null || value === '' ? '' : (Number(value) / 100).toFixed(2);
				break;
			case 'relations':
			case 'groups':
				values[field.name] = Array.isArray(value) ? value : [];
				break;
			case 'image':
			case 'images':
				files[field.name] = (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
				break;
			default:
				values[field.name] = value == null ? '' : value;
		}
	}
	return { values, files };
}

/**
 * Valores para repintar el formulario tras un error de validacion: lo que escribio el usuario
 * (checkbox y listas ya vienen de `raw`).
 */
export function toRepaintValues(resource, raw) {
	const values = {};
	for (const field of resource.fields) {
		if (FILE_TYPES.has(field.type)) continue;
		const value = raw[field.name];
		if (field.type === 'checkbox') values[field.name] = value !== undefined && value !== 'off';
		else if (field.type === 'relations' || field.type === 'groups') {
			values[field.name] = value === undefined ? [] : Array.isArray(value) ? value : [value];
		} else values[field.name] = value ?? '';
	}
	return values;
}
