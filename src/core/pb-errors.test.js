import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { fromPbError, guard } from './pb-errors.js';

const pbError = (status, data) => Object.assign(new Error('pb'), { status, response: { data } });

describe('fromPbError', () => {
	it('traduce errores de validacion con su campo', () => {
		const err = fromPbError(
			pbError(400, { slug: { code: 'validation_not_unique', message: 'x' } })
		);
		expect(err).toBeInstanceOf(DomainError);
		expect(err.field).toBe('slug');
		expect(err.message).toBe('Ya existe un registro con ese valor');
	});
	it('deja pasar otros errores', () => {
		const other = pbError(500, {});
		expect(fromPbError(other)).toBe(other);
	});
});

describe('guard', () => {
	it('relanza como DomainError', async () => {
		await expect(
			guard(() =>
				Promise.reject(pbError(400, { sku: { code: 'validation_required', message: 'm' } }))
			)
		).rejects.toMatchObject({ name: 'DomainError', field: 'sku' });
	});
	it('devuelve el resultado normal', async () => {
		await expect(guard(async () => 7)).resolves.toBe(7);
	});
});
