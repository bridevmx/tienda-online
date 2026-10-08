import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseForm } from './validate.js';

const schema = z.object({
	email: z.email('correo invalido'),
	password: z.string().min(1, 'falta')
});

describe('parseForm', () => {
	it('devuelve los datos validos desde FormData', () => {
		const fd = new FormData();
		fd.set('email', 'a@b.com');
		fd.set('password', 'x');
		expect(parseForm(schema, fd)).toEqual({ ok: true, data: { email: 'a@b.com', password: 'x' } });
	});
	it('devuelve un error por campo y conserva lo escrito sin los campos omitidos', () => {
		const res = parseForm(schema, { email: 'nope', password: '' }, { omit: ['password'] });
		expect(res.ok).toBe(false);
		expect(res.errors).toEqual({ email: 'correo invalido', password: 'falta' });
		expect(res.values).toEqual({ email: 'nope' });
	});
});
