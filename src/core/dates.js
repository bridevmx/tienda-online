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

/** "2026-10-08" del dia de `date` en la zona de la tienda. */
export function localDay(date = new Date()) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

/** Desfase de la zona de la tienda en una fecha, en minutos respecto a UTC (Mexico: -360). */
function offsetMinutes(date) {
	const part = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, timeZoneName: 'longOffset' })
		.formatToParts(date)
		.find((p) => p.type === 'timeZoneName')?.value;
	const m = part?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
	if (!m) return 0;
	return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Inicio (00:00 en la zona de la tienda) de un dia "YYYY-MM-DD", como instante UTC. */
export function startOfDayUtc(ymd) {
	const guess = new Date(`${ymd}T00:00:00Z`);
	return new Date(guess.getTime() - offsetMinutes(guess) * 60_000);
}

const addDays = (ymd, n) => {
	const d = new Date(`${ymd}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
};

/** Formato de fecha de PocketBase para filtros. */
const pb = (date) => date.toISOString().replace('T', ' ');

export const RANGES = {
	hoy: 'Hoy',
	'7d': 'Últimos 7 días',
	'30d': 'Últimos 30 días',
	mes: 'Este mes',
	todo: 'Todo'
};

/**
 * Rango de fechas para reportes: { from, to } en formato PocketBase (o null = sin limite), segun una
 * clave de RANGES o un par "YYYY-MM-DD" personalizado. Los dias se cuentan en la zona de la tienda.
 */
export function rangeFor(key, now = new Date(), custom = {}) {
	const today = localDay(now);
	const end = pb(new Date(startOfDayUtc(addDays(today, 1)).getTime() - 1));
	const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '');
	if (isDay(custom.from) || isDay(custom.to)) {
		return {
			from: isDay(custom.from) ? pb(startOfDayUtc(custom.from)) : null,
			to: isDay(custom.to) ? pb(new Date(startOfDayUtc(addDays(custom.to, 1)).getTime() - 1)) : null
		};
	}
	switch (key) {
		case 'hoy':
			return { from: pb(startOfDayUtc(today)), to: end };
		case '7d':
			return { from: pb(startOfDayUtc(addDays(today, -6))), to: end };
		case 'mes':
			return { from: pb(startOfDayUtc(`${today.slice(0, 8)}01`)), to: end };
		case 'todo':
			return { from: null, to: null };
		default: // 30d
			return { from: pb(startOfDayUtc(addDays(today, -29))), to: end };
	}
}
