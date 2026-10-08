import { describe, expect, it } from 'vitest';
import { formatDate, localDay, rangeFor, startOfDayUtc } from './dates.js';

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

describe('dias en la zona de la tienda', () => {
	it('localDay respeta la zona (madrugada UTC sigue siendo el dia anterior en Mexico)', () => {
		expect(localDay(new Date('2026-10-08T03:00:00Z'))).toBe('2026-10-07');
		expect(localDay(new Date('2026-10-08T07:00:00Z'))).toBe('2026-10-08');
	});
	it('startOfDayUtc: la medianoche de Mexico es 06:00 UTC', () => {
		expect(startOfDayUtc('2026-10-08').toISOString()).toBe('2026-10-08T06:00:00.000Z');
	});
});

describe('rangeFor', () => {
	const now = new Date('2026-10-08T15:00:00Z'); // 09:00 en Mexico
	it('hoy', () => {
		expect(rangeFor('hoy', now)).toEqual({
			from: '2026-10-08 06:00:00.000Z',
			to: '2026-10-09 05:59:59.999Z'
		});
	});
	it('7 y 30 dias incluyen hoy', () => {
		expect(rangeFor('7d', now).from).toBe('2026-10-02 06:00:00.000Z');
		expect(rangeFor('30d', now).from).toBe('2026-09-09 06:00:00.000Z');
		expect(rangeFor('desconocido', now).from).toBe('2026-09-09 06:00:00.000Z');
	});
	it('mes y todo', () => {
		expect(rangeFor('mes', now).from).toBe('2026-10-01 06:00:00.000Z');
		expect(rangeFor('todo', now)).toEqual({ from: null, to: null });
	});
	it('rango personalizado, inclusive en ambos extremos', () => {
		expect(rangeFor('30d', now, { from: '2026-10-01', to: '2026-10-03' })).toEqual({
			from: '2026-10-01 06:00:00.000Z',
			to: '2026-10-04 05:59:59.999Z'
		});
		expect(rangeFor('30d', now, { from: 'basura' }).from).toBe('2026-09-09 06:00:00.000Z');
	});
});
