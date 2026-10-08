import { describe, expect, it } from 'vitest';
import { passwordChangeSchema, profileSchema, registerSchema, resetSchema } from './schema.js';

const base = {
	name: 'Ana López',
	email: ' ANA@Correo.TEST ',
	phone: '',
	password: 'secreta123',
	passwordConfirm: 'secreta123'
};

describe('registerSchema', () => {
	it('normaliza el correo', () => {
		const r = registerSchema.safeParse(base);
		expect(r.success && r.data.email).toBe('ana@correo.test');
	});
	it('rechaza contraseñas cortas y que no coinciden', () => {
		expect(
			registerSchema.safeParse({ ...base, password: '123', passwordConfirm: '123' }).success
		).toBe(false);
		const r = registerSchema.safeParse({ ...base, passwordConfirm: 'otra-distinta' });
		expect(r.success).toBe(false);
		expect(r.error.issues[0].path).toEqual(['passwordConfirm']);
	});
	it('valida teléfono opcional', () => {
		expect(registerSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false);
		expect(registerSchema.safeParse({ ...base, phone: '55 1234 5678' }).success).toBe(true);
	});
});

describe('otros formularios', () => {
	it('reset exige coincidencia', () => {
		expect(
			resetSchema.safeParse({ password: 'abcdefgh', passwordConfirm: 'abcdefgh' }).success
		).toBe(true);
		expect(resetSchema.safeParse({ password: 'abcdefgh', passwordConfirm: 'x' }).success).toBe(
			false
		);
	});
	it('cambio de contraseña pide la actual', () => {
		expect(
			passwordChangeSchema.safeParse({
				oldPassword: '',
				password: 'abcdefgh',
				passwordConfirm: 'abcdefgh'
			}).success
		).toBe(false);
	});
	it('perfil exige nombre', () => {
		expect(profileSchema.safeParse({ name: '', phone: '' }).success).toBe(false);
	});
});
