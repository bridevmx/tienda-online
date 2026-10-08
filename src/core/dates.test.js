import { describe, expect, it } from 'vitest';
import { formatDate } from './dates.js';

describe('formatDate', () => {
	it('formatea fechas de PocketBase', () => {
		expect(formatDate('2026-10-08 05:04:54.960Z')).toMatch(/oct/i);
		expect(formatDate('2026-10-08 05:04:54.960Z', { time: true })).toMatch(/\d{1,2}:\d{2}/);
	});
	it('devuelve vacio con valores invalidos', () => {
		expect(formatDate('')).toBe('');
		expect(formatDate('no-es-fecha')).toBe('');
	});
});
