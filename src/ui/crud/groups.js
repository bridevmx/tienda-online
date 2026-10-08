/** Agrupa opciones por su `group` conservando el orden de aparicion: [{ key, label, items }]. Sin grupo -> uno solo. */
export function groupOptions(list) {
	const groups = new Map();
	for (const option of list) {
		const key = option.group?.key ?? '';
		if (!groups.has(key)) groups.set(key, { key, label: option.group?.label ?? '', items: [] });
		groups.get(key).items.push(option);
	}
	return [...groups.values()];
}
