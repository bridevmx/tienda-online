import { z } from 'zod';
import { optionalText } from '#core/fields.js';

const email = z
	.string({ error: 'Escribe tu correo' })
	.trim()
	.toLowerCase()
	.pipe(z.email({ error: 'Escribe un correo válido' }))
	.pipe(z.string().max(160));

const name = z.string({ error: 'Escribe tu nombre' }).trim().min(2, 'Escribe tu nombre').max(120);

const phone = optionalText(30).refine(
	(v) => v === '' || /^[+\d][\d\s().-]{6,28}$/.test(v),
	'Escribe un teléfono válido'
);

const password = z
	.string({ error: 'Escribe una contraseña' })
	.min(8, 'Usa al menos 8 caracteres')
	.max(72, 'Máximo 72 caracteres');

/** Dos campos de contraseña que deben coincidir. */
const withConfirm = (shape) =>
	z.object(shape).refine((v) => v.password === v.passwordConfirm, {
		path: ['passwordConfirm'],
		message: 'Las contraseñas no coinciden'
	});

export const registerSchema = withConfirm({
	name,
	email,
	phone,
	password,
	passwordConfirm: z.string().default('')
});

export const recoverSchema = z.object({ email });

export const resetSchema = withConfirm({ password, passwordConfirm: z.string().default('') });

export const profileSchema = z.object({ name, phone });

export const emailChangeSchema = z.object({ email });

export const passwordChangeSchema = withConfirm({
	oldPassword: z.string().min(1, 'Escribe tu contraseña actual'),
	password,
	passwordConfirm: z.string().default('')
});

export const confirmEmailSchema = z.object({
	password: z.string().min(1, 'Escribe tu contraseña')
});
