import { DomainError } from '#core/errors.js';
import { SETTINGS, SETTINGS_BY_KEY, decodeSetting, settingsFormSchema } from './registry.js';

/**
 * Valores tipados de todos los ajustes: { 'tax.iva_rate': 16, 'clip.apply_fee': false, ... }.
 * Lo que no esta en la base toma su valor por defecto. `records` = registros de `settings`.
 */
export function resolveSettings(records) {
	const stored = new Map(records.map((r) => [r.key, r.value]));
	return Object.fromEntries(
		SETTINGS.map((def) => [def.key, decodeSetting(def, stored.get(def.key))])
	);
}

// ---------- lectura con cache (para el servidor: precios, checkout) ----------
const TTL_MS = 30_000;
let cache = null;

/** Ajustes del servidor, cacheados 30 s. `getPb` devuelve un cliente de superusuario (locals.adminPb). */
export async function readSettings(getPb, { now = Date.now() } = {}) {
	if (cache && cache.expires > now) return cache.values;
	const records = await (await getPb()).collection('settings').getFullList();
	cache = { values: resolveSettings(records), expires: now + TTL_MS };
	return cache.values;
}

export function invalidateSettingsCache() {
	cache = null;
}

/** Servicio para la pantalla de ajustes (usa el cliente del personal: aplican las reglas de la base). */
export function createSettingsService(pb) {
	return {
		/** Valores tipados actuales. */
		async values() {
			return resolveSettings(await pb.collection('settings').getFullList());
		},

		/**
		 * Valida TODO antes de escribir. `input` = objeto del formulario (clave -> texto). Las claves
		 * ausentes no se tocan (salvo los booleanos, que un formulario no envia si estan apagados).
		 * Devuelve las claves que cambiaron.
		 */
		async save(input) {
			const parsed = settingsFormSchema.safeParse(input);
			if (!parsed.success) {
				const issue = parsed.error.issues[0];
				throw new DomainError(issue.message, { field: String(issue.path[0] ?? '_') });
			}
			const existing = new Map(
				(await pb.collection('settings').getFullList()).map((r) => [r.key, r])
			);
			const changed = [];
			for (const [key, value] of Object.entries(parsed.data)) {
				if (!SETTINGS_BY_KEY.has(key)) continue;
				const current = existing.get(key);
				const def = SETTINGS_BY_KEY.get(key);
				const before = current ? current.value : encodeDefault(def);
				if (current && current.value === value) continue;
				if (!current && value === before) continue; // igual al valor por defecto: no se crea el registro
				if (current) await pb.collection('settings').update(current.id, { value });
				else await pb.collection('settings').create({ key, value });
				changed.push(key);
			}
			invalidateSettingsCache();
			return changed;
		}
	};
}

/** Valor por defecto como texto guardado (para comparar). */
function encodeDefault(def) {
	switch (def.type) {
		case 'boolean':
			return String(def.default);
		case 'money':
		case 'integer':
		case 'percent':
			return String(def.default);
		default:
			return String(def.default ?? '');
	}
}
