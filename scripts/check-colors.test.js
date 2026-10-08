import { describe, expect, it } from 'vitest';
import { findForbidden } from './check-colors.js';

describe('findForbidden', () => {
	it('detecta clases prohibidas', () => {
		const src = '<div class="bg-base-100 btn-success hover:text-accent badge-warning/50">';
		expect(findForbidden(src).map((f) => f.match)).toEqual([
			'bg-base-100',
			'btn-success',
			'hover:text-accent',
			'badge-warning'
		]);
	});
	it('permite los 4 colores y neutral', () => {
		const src = '<button class="btn btn-primary bg-secondary text-info border-error btn-neutral">';
		expect(findForbidden(src)).toEqual([]);
	});
	it('no confunde texto normal con clases', () => {
		expect(findForbidden('const success = true; // warning: accent')).toEqual([]);
	});
});
