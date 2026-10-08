import { describe, expect, it } from 'vitest';
import { setFlash, takeFlash } from './flash.js';

function fakeCookies() {
	const jar = new Map();
	return {
		jar,
		get: (k) => jar.get(k),
		set: (k, v) => jar.set(k, v),
		delete: (k) => jar.delete(k)
	};
}

describe('flash', () => {
	it('se lee una sola vez', () => {
		const c = fakeCookies();
		setFlash(c, { text: 'Guardado' });
		expect(takeFlash(c)).toEqual({ type: 'info', text: 'Guardado' });
		expect(takeFlash(c)).toBeNull();
	});
	it('solo admite info o error y limita el largo', () => {
		const c = fakeCookies();
		setFlash(c, { type: 'otra', text: 'x'.repeat(500) });
		const flash = takeFlash(c);
		expect(flash.type).toBe('info');
		expect(flash.text).toHaveLength(200);
	});
	it('ignora cookies manipuladas', () => {
		const c = fakeCookies();
		c.set('flash', 'no-es-json');
		expect(takeFlash(c)).toBeNull();
		c.set('flash', JSON.stringify({ text: 5 }));
		expect(takeFlash(c)).toBeNull();
	});
});
