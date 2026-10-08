/**
 * Valida un destino de redireccion tomado de la URL (?next=...) para evitar open redirects:
 * solo rutas internas dentro de `prefix` (la ruta exacta o una subruta, no un hermano como
 * `/administrador` para el prefijo `/admin`).
 */
export function safeNext(value, { prefix = '/', fallback = '/' } = {}) {
	if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
	const hasControlChars = [...value].some((char) => char.charCodeAt(0) < 32);
	if (value.startsWith('//') || value.includes('\\') || hasControlChars) return fallback;

	const path = value.split(/[?#]/)[0];
	const base = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
	return path === base || path.startsWith(`${base}/`) ? value : fallback;
}
