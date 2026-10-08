import { describe, expect, it } from 'vitest';
import { loginSchema } from './schema.js';

describe('loginSchema', () => {
	it('recorta espacios del correo', () => {
		expect(loginSchema.parse({ email: '  a@b.com ', password: 'x' }).email).toBe('a@b.com');
	});
	it('rechaza correo invalido y contrasena vacia', () => {
		const res = loginSchema.safeParse({ email: 'no', password: '' });
		expect(res.success).toBe(false);
		expect(res.error.issues.map((i) => i.path[0]).sort()).toEqual(['email', 'password']);
	});
});
