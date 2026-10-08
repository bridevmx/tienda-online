import { z } from 'zod';
import { nameField, recordIdList, slugField, withSlug } from '#core/fields.js';

export const loginSchema = z.object({
	email: z
		.string()
		.trim()
		.pipe(z.email({ error: 'Escribe un correo válido' })),
	password: z.string().min(1, 'Escribe tu contraseña')
});

/** Rol: nombre, slug y los permisos que otorga. `system` no se edita desde la app. */
export const roleSchema = withSlug(
	z.object({
		name: nameField(100),
		slug: slugField(50),
		permissions: recordIdList()
	})
);
