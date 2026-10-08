/**
 * Temas disponibles. Cada tema se define en src/app.css con `@plugin 'daisyui/theme'`.
 * Para agregar uno: definirlo alli y registrarlo aqui.
 */
export const THEMES = [
	{ id: 'tienda', label: 'Claro' },
	{ id: 'tienda-noche', label: 'Noche' }
];

export const DEFAULT_THEME = THEMES[0].id;
export const THEME_COOKIE = 'theme';

/** Devuelve un id de tema valido; ante cualquier valor desconocido, el tema por defecto. */
export function resolveTheme(value) {
	return THEMES.some((t) => t.id === value) ? value : DEFAULT_THEME;
}
