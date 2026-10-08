/**
 * Guarda un registro y sus archivos en PocketBase. Los datos van primero como JSON (asi las listas
 * vacias limpian relaciones) y los archivos en una segunda llamada multipart. Si la subida falla en
 * un registro recien creado, se borra para no dejar a medias lo que el usuario intento crear.
 *
 * @param uploads  { campo: { files: File[], append: bool } }  append=true para campos de varios archivos
 * @param removals { campo: ['nombre.png'] }                   archivos existentes a quitar
 */
export async function saveRecord(pb, collection, id, data, { uploads = {}, removals = {} } = {}) {
	const record = id
		? await pb.collection(collection).update(id, data)
		: await pb.collection(collection).create(data);

	const hasUploads = Object.values(uploads).some((u) => u.files.length);
	const hasRemovals = Object.values(removals).some((list) => list.length);
	if (!hasUploads && !hasRemovals) return record;

	const body = new FormData();
	for (const [name, { files, append }] of Object.entries(uploads)) {
		for (const file of files) body.append(append ? `${name}+` : name, file);
	}
	for (const [name, filenames] of Object.entries(removals)) {
		for (const filename of filenames) body.append(`${name}-`, filename);
	}
	try {
		return await pb.collection(collection).update(record.id, body);
	} catch (err) {
		if (!id)
			await pb
				.collection(collection)
				.delete(record.id)
				.catch(() => {});
		throw err;
	}
}
