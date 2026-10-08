import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit.js';

describe('createRateLimiter', () => {
	it('bloquea al pasar el maximo y libera al terminar la ventana', () => {
		let t = 0;
		const rl = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
		expect(rl.hit('a')).toBe(false);
		expect(rl.hit('a')).toBe(false);
		expect(rl.isLimited('a')).toBe(true);
		expect(rl.hit('a')).toBe(true);
		expect(rl.isLimited('b')).toBe(false);
		t = 1001;
		expect(rl.isLimited('a')).toBe(false);
	});
	it('reset olvida la llave', () => {
		const rl = createRateLimiter({ max: 1, windowMs: 1000 });
		rl.hit('a');
		expect(rl.isLimited('a')).toBe(true);
		rl.reset('a');
		expect(rl.isLimited('a')).toBe(false);
	});
});
