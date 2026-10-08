import { describe, expect, it } from 'vitest';
import { clientKey } from './limits.js';

describe('clientKey', () => {
	it('devuelve la IP o una llave comun si no se puede saber', () => {
		expect(clientKey(() => '1.2.3.4')).toBe('1.2.3.4');
		expect(
			clientKey(() => {
				throw new Error('Address header was specified but is missing');
			})
		).toBe('unknown');
	});
});
