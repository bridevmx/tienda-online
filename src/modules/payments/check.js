/**
 * Comprobaciones que una solicitud de pago de Clip debe cumplir para darse por buena. Es la misma regla
 * que aplica `verifyClipPayment`, expresada como lista legible para el verificador manual
 * (`npm run clip:check`) y las pruebas en una cuenta real.
 *
 * @param remote    resultado de clip.getCheckout()
 * @param expected  { reference, amountCents }
 * @returns {{ name: string, ok: boolean, detail: string }[]}
 */
export function checkoutReport(remote, { reference, amountCents }) {
	const completed = remote.status === 'paid';
	return [
		{
			name: 'estado COMPLETADO',
			ok: completed,
			detail: String(remote.rawStatus ?? 'sin estado')
		},
		{
			name: 'referencia propia',
			ok: remote.reference === reference,
			detail: `Clip: ${remote.reference ?? 'ninguna'} · esperada: ${reference}`
		},
		{
			name: 'monto',
			ok: remote.amountCents === amountCents,
			detail: `Clip: ${remote.amountCents ?? 'ninguno'} · esperado: ${amountCents} centavos`
		},
		{
			name: 'moneda MXN',
			ok: remote.currency === 'MXN',
			detail: String(remote.currency ?? 'ninguna')
		},
		{
			name: 'receipt_no presente',
			ok: completed && !!remote.receiptNo,
			detail: remote.receiptNo ?? (completed ? 'falta' : 'solo aparece al completarse')
		}
	];
}

export const reportPasses = (report) => report.every((check) => check.ok);
