import { z } from 'zod';

export const loginSchema = z.object({
	email: z
		.string()
		.trim()
		.pipe(z.email({ error: 'Escribe un correo válido' })),
	password: z.string().min(1, 'Escribe tu contraseña')
});
