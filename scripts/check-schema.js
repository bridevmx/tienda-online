#!/usr/bin/env node
/**
 * Verifica convenciones del esquema en una instancia de PocketBase en marcha:
 * toda coleccion (salvo las internas `_*`) termina con los campos `created` y `updated`.
 * Uso: npm run check:schema   (necesita PocketBase y las credenciales de superusuario en .env)
 */
import { fileURLToPath } from 'node:url';
import { scriptPb } from './_pb.js';

/** Devuelve [{ collection, problem }] con las colecciones que incumplen la convencion. */
export function findTimestampViolations(collections) {
	const problems = [];
	for (const c of collections) {
		if (c.name.startsWith('_') || c.system) continue;
		const names = c.fields.map((f) => f.name);
		const tail = names.slice(-2);
		if (tail[0] !== 'created' || tail[1] !== 'updated') {
			problems.push({
				collection: c.name,
				problem: `created/updated deben ser los ultimos campos (hoy termina en: ${tail.join(', ')})`
			});
			continue;
		}
		const kinds = c.fields.slice(-2).map((f) => f.type);
		if (kinds.some((type) => type !== 'autodate')) {
			problems.push({ collection: c.name, problem: 'created/updated deben ser de tipo autodate' });
		}
	}
	return problems;
}

async function main() {
	const pb = await scriptPb();
	const collections = await pb.collections.getFullList();
	const problems = findTimestampViolations(collections);
	for (const { collection, problem } of problems) console.error(`${collection}: ${problem}`);
	if (problems.length) process.exit(1);
	console.log(
		`Esquema OK: ${collections.filter((c) => !c.name.startsWith('_')).length} colecciones con created/updated al final.`
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
