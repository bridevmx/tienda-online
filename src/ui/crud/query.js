/** Query string a partir del actual con cambios: `null` quita el parametro. */
export function withParams(url, changes) {
	const params = new URLSearchParams(url.searchParams);
	for (const [key, value] of Object.entries(changes)) {
		if (value == null) params.delete(key);
		else params.set(key, String(value));
	}
	return `?${params}`;
}
