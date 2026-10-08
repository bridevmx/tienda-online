/** Fechas de PocketBase ("2026-10-08 05:04:54.960Z") para mostrar. Una sola zona horaria: tienda en Mexico. */
export const TIMEZONE = 'America/Mexico_City';

const dateOnly = new Intl.DateTimeFormat('es-MX', { timeZone: TIMEZONE, dateStyle: 'medium' });
const dateTime = new Intl.DateTimeFormat('es-MX', {
	timeZone: TIMEZONE,
	dateStyle: 'medium',
	timeStyle: 'short'
});

export function formatDate(value, { time = false } = {}) {
	if (!value) return '';
	const date = new Date(String(value).replace(' ', 'T'));
	if (Number.isNaN(date.getTime())) return '';
	return (time ? dateTime : dateOnly).format(date);
}
