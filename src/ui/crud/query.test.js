import { describe, expect, it } from 'vitest';
import { withParams } from './query.js';

describe('withParams', () => {
	const url = new URL('http://x/admin/products?q=gorra&page=3');
	it('cambia y quita parametros sin tocar el resto', () => {
		expect(withParams(url, { sort: '-name', page: null })).toBe('?q=gorra&sort=-name');
		expect(withParams(url, { page: 2 })).toBe('?q=gorra&page=2');
	});
});
