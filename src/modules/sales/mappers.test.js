import { describe, expect, it } from 'vitest';
import { toCustomerOrder } from './mappers.js';

const settings = {
	'transfer.beneficiary': 'Mi Tienda',
	'transfer.bank': 'Banco X',
	'transfer.clabe': '012345678901234567',
	'transfer.instructions': 'Envía tu comprobante'
};
const bundle = (over = {}) => ({
	order: {
		code: 'W-20261008-ABCDE',
		channel: 'web',
		status: 'pending',
		payment_method: 'transfer',
		created: '2026-10-08 10:00:00.000Z',
		expires_at: '2026-10-09 10:00:00.000Z',
		subtotal: 104_061,
		discount: 4061,
		tax_total: 16_000,
		total: 116_000,
		access_token: 'TOKEN-SECRETO',
		...over.order
	},
	items: [
		{
			product_name: 'Gorra',
			variant_label: 'Negro',
			quantity: 2,
			line_total: 116_000,
			unit_base: 19_900
		}
	],
	payment: { status: 'pending', method: 'transfer', provider_url: '', proof: '', ...over.payment },
	financials: { fee_total: 4061, net_total: 100_000, base_total: 100_000 }
});

describe('toCustomerOrder', () => {
	it('arma lo visible para el cliente', () => {
		const view = toCustomerOrder(bundle(), settings);
		expect(view).toMatchObject({
			code: 'W-20261008-ABCDE',
			statusLabel: 'Pendiente de pago',
			statusBadge: 'info',
			methodLabel: 'Transferencia',
			items: [{ name: 'Gorra', label: 'Negro', qty: 2, total: 116_000 }],
			totals: { subtotal: 104_061, discount: 4061, iva: 16_000, total: 116_000 }
		});
		expect(view.transfer).toMatchObject({
			clabe: '012345678901234567',
			reference: 'W-20261008-ABCDE'
		});
	});
	it('NO contiene finanzas internas, precios base ni el token', () => {
		const json = JSON.stringify(toCustomerOrder(bundle(), settings));
		for (const leaked of [
			'fee_total',
			'net_total',
			'base_total',
			'unit_base',
			'19900',
			'100000',
			'TOKEN-SECRETO',
			'access_token',
			'financials'
		]) {
			expect(json, leaked).not.toContain(leaked);
		}
	});
	it('los datos bancarios solo mientras la transferencia esta pendiente', () => {
		expect(toCustomerOrder(bundle({ order: { status: 'paid' } }), settings).transfer).toBeNull();
		expect(
			toCustomerOrder(bundle({ order: { status: 'cancelled' } }), settings).transfer
		).toBeNull();
	});
	it('el enlace de pago solo mientras la tarjeta esta pendiente', () => {
		const card = bundle({
			order: { payment_method: 'card_clip' },
			payment: { method: 'card_clip', provider_url: 'https://pay/1' }
		});
		expect(toCustomerOrder(card, settings).payment.payUrl).toBe('https://pay/1');
		card.order.status = 'paid';
		card.payment.status = 'confirmed';
		expect(toCustomerOrder(card, settings).payment.payUrl).toBeNull();
		expect(toCustomerOrder(card, settings).expiresAt).toBeNull();
	});
	it('refleja el comprobante cargado', () => {
		expect(
			toCustomerOrder(bundle({ payment: { proof: 'x.png' } }), settings).payment.hasProof
		).toBe(true);
	});
});
