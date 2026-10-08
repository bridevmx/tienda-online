/// <reference path="../pb_data/types.d.ts" />
/**
 * Convencion: `created` y `updated` van SIEMPRE al final de cada coleccion. Esta migracion lo
 * garantiza en las colecciones existentes (users, customers y categories los tenian en medio
 * porque se agregaron campos despues). Solo cambia el orden de los campos, no los datos.
 *
 * Al agregar campos a una coleccion en una migracion nueva, volver a dejar los timestamps al final
 * (ver `npm run check:schema`).
 */
migrate(
	(app) => {
		for (const collection of app.findAllCollections()) {
			if (collection.system || collection.name.startsWith('_')) continue;
			for (const name of ['created', 'updated']) {
				const field = collection.fields.getByName(name);
				if (!field) continue;
				collection.fields.removeByName(name);
				collection.fields.add(field); // mismo campo (mismo id): se mueve al final, no se recrea
			}
			app.save(collection);
		}
	},
	() => {
		// solo era un reordenamiento de metadatos; no hay nada que revertir
	}
);
