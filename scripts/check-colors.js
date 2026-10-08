#!/usr/bin/env node
/**
 * Falla si el markup usa clases de color prohibidas: base-*, success, warning o accent.
 * Politica de temas: solo 4 colores (primary, secondary, info, error); ver docs/PLAN.md.
 * src/app.css queda fuera porque ahi se definen los temas.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN =
	/(?<![\w-])(?:[\w]+:)*(?:bg|text|border|ring|fill|stroke|outline|divide|shadow|from|via|to|btn|badge|alert|toast|progress|checkbox|toggle|radio|input|select|textarea|range|tooltip|link|loading|step|menu|tab|card|kbd|status|swap|rating|file-input|table|collapse|stat)-(?:base-(?:100|200|300|content)|success|warning|accent)(?:-content)?(?![\w-])/g;

const EXTENSIONS = ['.svelte', '.html', '.js'];

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* walk(path);
		else if (EXTENSIONS.some((ext) => path.endsWith(ext))) yield path;
	}
}

/** Devuelve [{ line, match }] con las clases prohibidas encontradas en el texto. */
export function findForbidden(source) {
	const found = [];
	source.split('\n').forEach((text, i) => {
		for (const match of text.matchAll(FORBIDDEN)) found.push({ line: i + 1, match: match[0] });
	});
	return found;
}

function main() {
	const root = fileURLToPath(new URL('../src', import.meta.url));
	let failures = 0;
	for (const file of walk(root)) {
		for (const { line, match } of findForbidden(readFileSync(file, 'utf8'))) {
			console.error(`${relative(process.cwd(), file)}:${line}  clase prohibida "${match}"`);
			failures++;
		}
	}
	if (failures) {
		console.error(
			`\n${failures} uso(s) de clases prohibidas. Usa primary, secondary, info o error.`
		);
		process.exit(1);
	}
	console.log('Colores OK: no hay clases base-*, success, warning ni accent.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
