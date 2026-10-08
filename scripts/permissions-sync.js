#!/usr/bin/env node
/**
 * Sincroniza permisos y roles base desde los manifiestos de los modulos.
 * Uso: npm run permissions:sync [-- --prune]
 */
import { collectPermissions } from '#core/module.js';
import { modules } from '#modules/index.js';
import { syncPermissions } from '#modules/access/sync.js';
import { scriptPb } from './_pb.js';

const prune = process.argv.includes('--prune');
const pb = await scriptPb();
const s = await syncPermissions(pb, collectPermissions(modules), { prune });

console.log(`Permisos creados:      ${s.created.length}`);
console.log(`Permisos actualizados: ${s.updated.length}`);
console.log(`Roles creados:         ${s.rolesCreated.join(', ') || '-'}`);
for (const [slug, codes] of Object.entries(s.grants)) {
	console.log(`  + ${slug}: ${codes.length} permiso(s) otorgado(s)`);
}
if (s.stale.length) {
	console.log(
		`Permisos que ya no existen en el codigo (${s.stale.length}): ${s.stale.join(', ')}` +
			(prune ? '\n  -> eliminados' : '\n  -> usa --prune para eliminarlos')
	);
}
