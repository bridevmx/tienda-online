/**
 * Utilidades de formularios. Todo lo que llega de un <form> es texto (o archivos).
 */

/** FormData -> objeto. Los campos repetidos (checkboxes, selects multiples) pasan a arreglo; los archivos se ignoran. */
export function formDataToObject(formData) {
	const out = {};
	for (const [key, value] of formData.entries()) {
		if (typeof value !== 'string') continue;
		if (key in out) out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
		else out[key] = value;
	}
	return out;
}

/** Archivos subidos por campo: { images: [File, ...] }. Ignora inputs de archivo vacios. */
export function extractFiles(formData, names) {
	const files = {};
	for (const name of names) {
		const list = formData.getAll(name).filter((f) => typeof f !== 'string' && f.size > 0 && f.name);
		if (list.length) files[name] = list;
	}
	return files;
}

/**
 * Valida un FormData (o un objeto) con un schema de Zod.
 * Devuelve { ok: true, data } o { ok: false, errors: { campo: 'mensaje' }, values }.
 * `values` conserva lo escrito (menos campos sensibles) para repintar el formulario.
 */
export function parseForm(schema, input, { omit = [] } = {}) {
	const raw = input instanceof FormData ? formDataToObject(input) : { ...input };
	const result = schema.safeParse(raw);
	if (result.success) return { ok: true, data: result.data };

	const errors = {};
	for (const issue of result.error.issues) {
		const key = issue.path.join('.') || '_';
		if (!(key in errors)) errors[key] = issue.message;
	}
	const values = Object.fromEntries(Object.entries(raw).filter(([k]) => !omit.includes(k)));
	return { ok: false, errors, values };
}
