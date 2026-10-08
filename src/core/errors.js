/**
 * Error de dominio: una regla de negocio no se cumple (no es un fallo del sistema).
 * `field` indica el campo del formulario al que se asocia el mensaje, si aplica.
 */
export class DomainError extends Error {
	constructor(message, { field = '_', cause } = {}) {
		super(message, cause ? { cause } : undefined);
		this.name = 'DomainError';
		this.field = field;
	}
}
