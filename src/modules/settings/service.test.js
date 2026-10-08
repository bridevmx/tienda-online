import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '#core/errors.js';
import {
	createSettingsService,
	invalidateSettingsCache,
	readSettings,
	resolveSettings
} from './service.js';

function fakePb(initial = []) {
	const db = initial.map((r, i) => ({ id: `r${i}`, ...r }));
	const writes = [];
	return {
		db,
		writes,
		collection: () => ({
			getFullList: async () => db.map((r) => ({ ...r })),
			create: async (data) => {
				writes.push(['create', data]);
				db.push({ id: `n${db.length}`, ...data });
			},
			update: async (id, data) => {
				writes.push(['update', id, data]);
				Object.assign(
					db.find((r) => r.id === id),
					data
				);
			}
		})
	};
}

beforeEach(() => invalidateSettingsCache());

describe('resolveSettings', () => {
	it('mezcla lo guardado con los valores por defecto', () => {
		const values = resolveSettings([{ key: 'tax.iva_rate', value: '8' }]);
		expect(values['tax.iva_rate']).toBe(8);
		expect(values['clip.fee_rate']).toBe(2.9);
		expect(values['tax.apply_iva']).toBe(true);
	});
});

describe('createSettingsService.save', () => {
	it('crea o actualiza solo lo que cambio y no crea registros iguales al valor por defecto', async () => {
		const pb = fakePb([{ key: 'tax.iva_rate', value: '16' }]);
		const changed = await createSettingsService(pb).save({
			'tax.iva_rate': '8', // cambia -> update
			'clip.fee_rate': '3.1', // distinto del default -> create
			'orders.pending_ttl_hours': '24' // igual al default -> no se crea
		});
		// los booleanos ausentes quedan apagados: apply_iva y discount_non_card cambian (default true)
		expect([...changed].sort()).toEqual(
			['clip.fee_rate', 'pricing.discount_non_card', 'tax.apply_iva', 'tax.iva_rate'].sort()
		);
		expect(pb.writes.find((w) => w[0] === 'update')[2]).toEqual({ value: '8' });
		expect(pb.db.find((r) => r.key === 'clip.fee_rate').value).toBe('3.1');
		expect(pb.db.some((r) => r.key === 'orders.pending_ttl_hours')).toBe(false);
	});
	it('un booleano que el formulario no envia queda apagado', async () => {
		const pb = fakePb([{ key: 'tax.apply_iva', value: 'true' }]);
		await createSettingsService(pb).save({ 'store.name': 'X' });
		expect(pb.db.find((r) => r.key === 'tax.apply_iva').value).toBe('false');
	});
	it('no escribe nada si algun campo es invalido', async () => {
		const pb = fakePb();
		await expect(
			createSettingsService(pb).save({ 'store.name': 'Ok', 'tax.iva_rate': 'abc' })
		).rejects.toMatchObject({ name: 'DomainError', field: 'tax.iva_rate' });
		expect(pb.writes).toHaveLength(0);
	});
	it('ignora claves desconocidas', async () => {
		const pb = fakePb();
		await createSettingsService(pb).save({ 'store.name': 'Ok', 'hack.admin': 'true' });
		expect(pb.db.some((r) => r.key === 'hack.admin')).toBe(false);
	});
	it('lanza DomainError', async () => {
		await expect(
			createSettingsService(fakePb()).save({ 'tax.iva_rate': '' })
		).rejects.toBeInstanceOf(DomainError);
	});
});

describe('readSettings (cache)', () => {
	it('cachea 30 s y se invalida al guardar', async () => {
		const pb = fakePb([{ key: 'tax.iva_rate', value: '10' }]);
		let calls = 0;
		const getPb = async () => (calls++, pb);
		const t0 = 1_000_000;
		expect((await readSettings(getPb, { now: t0 }))['tax.iva_rate']).toBe(10);
		pb.db[0].value = '12';
		expect((await readSettings(getPb, { now: t0 + 10_000 }))['tax.iva_rate']).toBe(10); // cache
		expect(calls).toBe(1);
		expect((await readSettings(getPb, { now: t0 + 31_000 }))['tax.iva_rate']).toBe(12); // vencio
		await createSettingsService(pb).save({ 'tax.iva_rate': '9' });
		expect((await readSettings(getPb, { now: t0 + 32_000 }))['tax.iva_rate']).toBe(9); // invalidada
	});
});
