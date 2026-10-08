/**
 * Valida un FormData (o un objeto) con un schema de Zod.
 * Devuelve { ok: true, data } o { ok: false, errors: { campo: 'mensaje' }, values }.
 * `values` conserva lo escrito (menos campos sensibles) para repintar el formulario.
 */
export function parseForm(schema, input, { omit = [] } = {}) {
	const raw = input instanceof FormData ? Object.fromEntries(input) : { ...input };
	const result = schema.safeParse(raw);
	if (result.success) return { ok: true, data: result.data };

	const errors = {};
	for (const issue of result.error.issues) {
		const key = issue.path.join('.') || '_';
		if (!(key in errors)) errors[key] = issue.message;
	}
	const values = Object.fromEntries(
		Object.entries(raw).filter(([k, v]) => typeof v === 'string' && !omit.includes(k))
	);
	return { ok: false, errors, values };
}
