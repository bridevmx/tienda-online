import { describe, expect, it } from 'vitest';
import { can, canAll, canAny } from './can.js';

const perms = new Set(['products:read', 'products:update']);

describe('can', () => {
	it('revisa un permiso', () => {
		expect(can(perms, 'products:update')).toBe(true);
		expect(can(perms, 'products:delete')).toBe(false);
	});
	it('niega si no hay un Set', () => {
		expect(can(undefined, 'products:read')).toBe(false);
		expect(can(['products:read'], 'products:read')).toBe(false);
	});
	it('combina permisos', () => {
		expect(canAny(perms, ['x:y', 'products:read'])).toBe(true);
		expect(canAll(perms, ['products:read', 'x:y'])).toBe(false);
	});
});
