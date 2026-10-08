#!/usr/bin/env node
/**
 * Da de alta a una persona del personal.
 * Uso: STAFF_PASSWORD=... npm run create-staff -- --email a@b.com --name "Ana" [--role admin]
 * Sin STAFF_PASSWORD se genera una contrasena aleatoria y se imprime una sola vez.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { scriptPb } from './_pb.js';

const { values } = parseArgs({
	options: {
		email: { type: 'string' },
		name: { type: 'string' },
		role: { type: 'string', default: 'admin' }
	}
});
if (!values.email || !values.name) {
	console.error('Uso: npm run create-staff -- --email a@b.com --name "Ana" [--role admin]');
	process.exit(1);
}

const pb = await scriptPb();
const role = await pb
	.collection('roles')
	.getFirstListItem(pb.filter('slug = {:slug}', { slug: values.role }))
	.catch(() => null);
if (!role) {
	console.error(`No existe el rol "${values.role}". Corre antes: npm run permissions:sync`);
	process.exit(1);
}

const generated = !process.env.STAFF_PASSWORD;
const password = process.env.STAFF_PASSWORD || randomBytes(12).toString('base64url');
await pb.collection('users').create({
	email: values.email,
	name: values.name,
	password,
	passwordConfirm: password,
	role: role.id,
	active: true,
	emailVisibility: false
});
console.log(`Usuario creado: ${values.email} (rol ${role.slug})`);
if (generated) console.log(`Contrasena temporal: ${password}`);
