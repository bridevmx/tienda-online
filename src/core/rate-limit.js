/**
 * Limitador de intentos en memoria (ventana deslizante). Suficiente para una sola instancia de
 * Node; con varias instancias cada una cuenta por separado. Las llaves las arma el llamador
 * (accion + IP, accion + correo...).
 */
export function createRateLimiter({ max, windowMs, now = Date.now }) {
	const hits = new Map();

	const recent = (key) => {
		const t = now();
		const list = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
		if (list.length) hits.set(key, list);
		else hits.delete(key);
		return list;
	};

	return {
		/** ¿Ya se alcanzo el limite? (no cuenta un intento) */
		isLimited: (key) => recent(key).length >= max,
		/** Cuenta un intento; devuelve true si con este ya se paso del limite. */
		hit(key) {
			if (hits.size > 5000) for (const k of [...hits.keys()]) recent(k);
			const list = recent(key);
			list.push(now());
			hits.set(key, list);
			return list.length > max;
		},
		reset: (key) => void hits.delete(key)
	};
}
