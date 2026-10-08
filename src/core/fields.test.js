import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { checkbox, integer, optionalRecordId, optionalText, recordIdList } from './fields.js';

describe('checkbox', () => {
	const schema = z.object({ active: checkbox(false) });
	it('interpreta los valores de un formulario HTML', () => {
		expect(schema.parse({ active: 'on' }).active).toBe(true);
		expect(schema.parse({}).active).toBe(false);
		expect(z.object({ a: checkbox(true) }).parse({}).a).toBe(true);
	});
});

describe('integer', () => {
	const schema = integer({ min: 0, defaultValue: 0 });
	it('convierte texto y aplica el valor por defecto', () => {
		expect(schema.parse('12')).toBe(12);
		expect(schema.parse('')).toBe(0);
		expect(schema.parse(undefined)).toBe(0);
	});
	it('rechaza decimales, texto y negativos', () => {
		expect(schema.safeParse('1.5').success).toBe(false);
		expect(schema.safeParse('abc').success).toBe(false);
		expect(schema.safeParse('-1').success).toBe(false);
	});
});

describe('optionalText / ids', () => {
	it('normaliza vacios', () => {
		expect(optionalText().parse(undefined)).toBe('');
		expect(optionalText().parse('  hola ')).toBe('hola');
		expect(optionalRecordId().parse('')).toBe('');
		expect(optionalRecordId().safeParse('x').success).toBe(false);
	});
	it('recordIdList acepta uno, varios o ninguno', () => {
		const id = 'abcdefghij12345';
		expect(recordIdList().parse(undefined)).toEqual([]);
		expect(recordIdList().parse(id)).toEqual([id]);
		expect(recordIdList().parse([id, id])).toEqual([id, id]);
		expect(recordIdList().parse(['', id, ''])).toEqual([id]); // selects en blanco
	});
});
