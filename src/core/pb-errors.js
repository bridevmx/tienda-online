import { DomainError } from './errors.js';

const MESSAGES = {
	validation_not_unique: 'Ya existe un registro con ese valor',
	validation_required: 'Este campo es obligatorio',
	validation_min_number_constraint: 'El valor es menor al mínimo permitido',
	validation_invalid_format: 'El formato no es válido'
};

/**
 * Convierte un error de validacion de PocketBase (400 con detalle por campo) en un DomainError
 * con el campo afectado. Cualquier otro error se devuelve tal cual.
 */
export function fromPbError(err) {
	const data = err?.response?.data;
	if (err?.status === 400 && data && typeof data === 'object') {
		const [field, info] = Object.entries(data)[0] ?? [];
		if (field) {
			return new DomainError(MESSAGES[info?.code] ?? info?.message ?? 'Valor inválido', { field });
		}
	}
	return err;
}

/** Ejecuta `fn` y traduce los errores de validacion de PocketBase a DomainError. */
export async function guard(fn) {
	try {
		return await fn();
	} catch (err) {
		throw fromPbError(err);
	}
}
