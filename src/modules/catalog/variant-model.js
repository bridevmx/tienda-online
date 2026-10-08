/**
 * Seleccion de variantes en la pagina de producto (funciones puras, sin acceso a datos).
 *
 * Una variante es { id, stock, options: [{ optionId, option, optionSort, valueId, value, valueSort }] }
 * y solo se pasan las ACTIVAS. La seleccion es un Map optionId -> valueId y vive en la URL
 * (?v=<valueId>&v=<valueId>), asi la pagina funciona sin JavaScript y se puede compartir.
 */

/** Opciones del producto con sus valores (solo los que alguna variante usa), en orden estable. */
export function buildOptionModel(variants) {
	const options = new Map();
	for (const variant of variants) {
		for (const o of variant.options) {
			if (!options.has(o.optionId)) {
				options.set(o.optionId, {
					id: o.optionId,
					name: o.option,
					sort: o.optionSort ?? 0,
					values: new Map()
				});
			}
			const values = options.get(o.optionId).values;
			if (!values.has(o.valueId))
				values.set(o.valueId, { id: o.valueId, value: o.value, sort: o.valueSort ?? 0 });
		}
	}
	return [...options.values()]
		.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
		.map((o) => ({
			id: o.id,
			name: o.name,
			values: [...o.values.values()]
				.sort((a, b) => a.sort - b.sort || a.value.localeCompare(b.value))
				.map(({ id, value }) => ({ id, value }))
		}));
}

/** Ids de valor (de la URL) -> seleccion valida: ignora ids que no existen y deja uno por opcion (el ultimo gana). */
export function selectionFrom(valueIds, model) {
	const owner = new Map();
	for (const option of model) for (const value of option.values) owner.set(value.id, option.id);
	const selection = new Map();
	for (const id of valueIds) if (owner.has(id)) selection.set(owner.get(id), id);
	return selection;
}

const matches = (variant, selection) =>
	[...selection].every(([optionId, valueId]) =>
		variant.options.some((o) => o.optionId === optionId && o.valueId === valueId)
	);

/** La variante que coincide EXACTAMENTE con la seleccion completa (o null si falta alguna opcion o no existe). */
export function findVariant(variants, model, selection) {
	if (selection.size !== model.length) return null;
	return variants.find((v) => v.options.length === model.length && matches(v, selection)) ?? null;
}

/**
 * Estado de cada valor segun lo ya elegido en las OTRAS opciones: 'available' (hay stock),
 * 'soldout' (la combinacion existe pero sin stock) o 'impossible' (no existe esa combinacion).
 */
export function valueStates(variants, model, selection) {
	const states = new Map();
	for (const option of model) {
		const others = new Map([...selection].filter(([optionId]) => optionId !== option.id));
		for (const value of option.values) {
			const candidates = variants.filter(
				(v) =>
					matches(v, others) &&
					v.options.some((o) => o.optionId === option.id && o.valueId === value.id)
			);
			states.set(value.id, {
				selected: selection.get(option.id) === value.id,
				status: candidates.some((v) => v.stock > 0)
					? 'available'
					: candidates.length
						? 'soldout'
						: 'impossible'
			});
		}
	}
	return states;
}

/** Seleccion inicial: la primera variante con stock (o la primera a secas si todas estan agotadas). */
export function defaultSelection(variants) {
	const pick = variants.find((v) => v.stock > 0) ?? variants[0];
	return new Map((pick?.options ?? []).map((o) => [o.optionId, o.valueId]));
}

/** Ids de valor para armar el enlace de un chip: la seleccion actual con `valueId` en lugar del de su opcion. */
export function paramsWith(model, selection, optionId, valueId) {
	const next = new Map(selection);
	next.set(optionId, valueId);
	return model.filter((o) => next.has(o.id)).map((o) => next.get(o.id));
}
