import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractFiles, formDataToObject, parseForm } from './validate.js';

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

describe('formDataToObject', () => {
	it('agrupa campos repetidos y omite archivos', () => {
		const fd = new FormData();
		fd.append('a', '1');
		fd.append('tags', 'x');
		fd.append('tags', 'y');
		fd.append('tags', 'z');
		fd.append('file', new File(['hola'], 'a.txt'));
		expect(formDataToObject(fd)).toEqual({ a: '1', tags: ['x', 'y', 'z'] });
	});
});

describe('extractFiles', () => {
	it('devuelve solo archivos con contenido', () => {
		const fd = new FormData();
		fd.append('images', new File(['abc'], 'a.png'));
		fd.append('images', new File([], ''));
		fd.append('image', new File([], ''));
		expect(Object.keys(extractFiles(fd, ['images', 'image']))).toEqual(['images']);
		expect(extractFiles(fd, ['images']).images).toHaveLength(1);
	});
});
