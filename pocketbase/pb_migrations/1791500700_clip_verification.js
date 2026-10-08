/// <reference path="../pb_data/types.d.ts" />
/**
 * Verificacion de pagos de Clip: referencia propia firmada (`reference`, la que se manda a Clip en
 * metadata.external_reference), recibo de Clip (`receipt_no`, unico: un recibo no puede acreditar dos
 * pedidos) y nota de anomalias (`provider_note`: monto/moneda/referencia distintos en un pago completado,
 * para revision manual). Solo esquema.
 */
migrate(
	(app) => {
		const payments = app.findCollectionByNameOrId('payments');
		payments.fields.add(new TextField({ name: 'reference', max: 36 }));
		payments.fields.add(new TextField({ name: 'receipt_no', max: 64 }));
		payments.fields.add(new TextField({ name: 'provider_note', max: 255 }));
		// convencion: created y updated siempre al final
		for (const name of ['created', 'updated']) {
			const field = payments.fields.getByName(name);
			payments.fields.removeByName(name);
			payments.fields.add(field);
		}
		payments.indexes = [
			...payments.indexes,
			"CREATE UNIQUE INDEX idx_payments_reference ON payments (reference) WHERE reference != ''",
			"CREATE UNIQUE INDEX idx_payments_receipt ON payments (receipt_no) WHERE receipt_no != ''"
		];
		app.save(payments);
	},
	(app) => {
		const payments = app.findCollectionByNameOrId('payments');
		payments.indexes = payments.indexes.filter(
			(i) => !i.includes('idx_payments_reference') && !i.includes('idx_payments_receipt')
		);
		for (const name of ['reference', 'receipt_no', 'provider_note'])
			payments.fields.removeByName(name);
		app.save(payments);
	}
);
