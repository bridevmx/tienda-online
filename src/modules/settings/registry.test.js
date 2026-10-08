import { describe, expect, it } from 'vitest';
import {
	SETTINGS,
	SETTINGS_BY_KEY,
	decodeSetting,
	encodeSetting,
	settingsFormSchema,
	toFormValue
} from './registry.js';

const def = (key) => SETTINGS_BY_KEY.get(key);

describe('registro', () => {
	it('claves unicas y con valor por defecto del tipo correcto', () => {
		expect(new Set(SETTINGS.map((s) => s.key)).size).toBe(SETTINGS.length);
		for (const s of SETTINGS) {
			expect(s.default).not.toBeUndefined();
			// todo valor por defecto debe sobrevivir a codificar y decodificar
			const form = toFormValue(s, s.default);
			const encoded = encodeSetting(s, s.type === 'boolean' ? (form ? 'on' : 'off') : form);
			expect(decodeSetting(s, encoded)).toEqual(s.default);
		}
	});
});

describe('encodeSetting', () => {
	it('porcentaje: acepta coma y 2 decimales, rechaza el resto', () => {
		expect(encodeSetting(def('clip.fee_rate'), '2.9')).toBe('2.9');
		expect(encodeSetting(def('clip.fee_rate'), '2,95')).toBe('2.95');
		expect(encodeSetting(def('clip.fee_rate'), ' 16 ')).toBe('16');
		for (const bad of ['', 'abc', '2.999', '-1', '101', '1e3']) {
			expect(() => encodeSetting(def('clip.fee_rate'), bad)).toThrow();
		}
	});
	it('dinero: pesos -> centavos', () => {
		expect(encodeSetting(def('clip.fee_fixed'), '2.50')).toBe('250');
		expect(encodeSetting(def('clip.fee_fixed'), '')).toBe('0');
		expect(() => encodeSetting(def('clip.fee_fixed'), '-1')).toThrow();
		expect(() => encodeSetting(def('clip.fee_fixed'), 'abc')).toThrow();
	});
	it('entero con rango', () => {
		expect(encodeSetting(def('orders.pending_ttl_hours'), '48')).toBe('48');
		for (const bad of ['0', '721', '1.5', '', 'x']) {
			expect(() => encodeSetting(def('orders.pending_ttl_hours'), bad)).toThrow();
		}
	});
	it('booleano', () => {
		expect(encodeSetting(def('tax.apply_iva'), 'on')).toBe('true');
		expect(encodeSetting(def('tax.apply_iva'), 'off')).toBe('false');
		expect(() => encodeSetting(def('tax.apply_iva'), 'quizas')).toThrow();
	});
	it('texto: obligatorio, largo maximo y patron (CLABE)', () => {
		expect(() => encodeSetting(def('store.name'), '  ')).toThrow(/obligatorio/);
		expect(() => encodeSetting(def('store.name'), 'x'.repeat(81))).toThrow(/Máximo/);
		expect(encodeSetting(def('transfer.clabe'), '')).toBe('');
		expect(encodeSetting(def('transfer.clabe'), '012345678901234567')).toBe('012345678901234567');
		expect(() => encodeSetting(def('transfer.clabe'), '123')).toThrow(/18 dígitos/);
	});
});

describe('decodeSetting', () => {
	it('sin valor o con valor corrupto: el valor por defecto', () => {
		expect(decodeSetting(def('tax.iva_rate'), undefined)).toBe(16);
		expect(decodeSetting(def('tax.iva_rate'), 'basura')).toBe(16);
		expect(decodeSetting(def('tax.apply_iva'), 'quizas')).toBe(true);
		expect(decodeSetting(def('orders.pending_ttl_hours'), '1.5')).toBe(24);
	});
	it('valores validos', () => {
		expect(decodeSetting(def('clip.fee_rate'), '3.5')).toBe(3.5);
		expect(decodeSetting(def('clip.fee_fixed'), '250')).toBe(250);
		expect(decodeSetting(def('clip.apply_fee'), 'true')).toBe(true);
	});
});

describe('settingsFormSchema', () => {
	it('un booleano ausente es apagado; el resto ausente no se toca', () => {
		const out = settingsFormSchema.parse({ 'store.name': 'Mi tienda' });
		expect(out['store.name']).toBe('Mi tienda');
		expect(out['tax.apply_iva']).toBe('false');
		expect('tax.iva_rate' in out).toBe(false);
	});
	it('reporta el campo con error', () => {
		const res = settingsFormSchema.safeParse({ 'tax.iva_rate': 'x' });
		expect(res.success).toBe(false);
		expect(res.error.issues[0].path).toEqual(['tax.iva_rate']);
	});
});

describe('toFormValue', () => {
	it('dinero en pesos', () => expect(toFormValue(def('clip.fee_fixed'), 250)).toBe('2.50'));
});
