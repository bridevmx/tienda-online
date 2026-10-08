import { describe, expect, it } from 'vitest';
import { ORDER_CODE_PATTERN, newAccessToken, newRecordId, orderCode, pbDate } from './ids.js';

describe('newRecordId', () => {
	it('15 caracteres validos para PocketBase', () => {
		for (let i = 0; i < 50; i++) expect(newRecordId()).toMatch(/^[a-z0-9]{15}$/);
		expect(newRecordId()).not.toBe(newRecordId());
	});
});

describe('orderCode', () => {
	const date = new Date('2026-10-08T12:00:00Z');
	it('prefijo por canal, fecha y 5 caracteres sin ambiguos', () => {
		const web = orderCode('web', date);
		const pos = orderCode('pos', date);
		expect(web).toMatch(/^W-20261008-[A-HJ-NP-Z2-9]{5}$/);
		expect(pos).toMatch(/^P-20261008-/);
		expect(web).toMatch(ORDER_CODE_PATTERN);
	});
	it('es distinto cada vez', () => {
		expect(new Set(Array.from({ length: 200 }, () => orderCode('web', date))).size).toBe(200);
	});
});

describe('newAccessToken / pbDate', () => {
	it('token largo y url-safe', () => {
		expect(newAccessToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});
	it('formato de fecha de PocketBase', () => {
		expect(pbDate(new Date('2026-10-08T05:04:54.960Z'))).toBe('2026-10-08 05:04:54.960Z');
	});
});
