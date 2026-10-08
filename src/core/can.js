/**
 * Permisos: codigos `modulo:accion` (ej. 'products:update') que vienen de las colecciones
 * `permissions` y `roles`. `permissions` es un Set con los codigos del usuario.
 */
export function can(permissions, code) {
	return permissions instanceof Set && permissions.has(code);
}

export function canAny(permissions, codes) {
	return codes.some((code) => can(permissions, code));
}

export function canAll(permissions, codes) {
	return codes.every((code) => can(permissions, code));
}
