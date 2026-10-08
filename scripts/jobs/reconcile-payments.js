#!/usr/bin/env node
/**
 * Respaldo del webhook de Clip: pregunta a Clip por los pagos con tarjeta pendientes y confirma (o
 * marca fallidos) los que ya cambiaron. Clip no documenta reintentos de webhook, asi que un aviso perdido
 * dejaria un pedido pagado como pendiente.
 * Uso: npm run jobs:reconcile-payments      (cron cada 2-5 minutos)
 *
 * Ejemplo de crontab:  *\/5 * * * *  cd /ruta/tienda && npm run -s jobs:reconcile-payments >> reconcile.log 2>&1
 */
import { reconcileClipPayments } from '#modules/payments/reconcile.js';
import { createSalesService } from '#modules/sales/service.js';
import { readSettings } from '#modules/settings/service.js';
import { scriptClip } from '../_clip.js';
import { scriptPb } from '../_pb.js';

const clip = scriptClip();
if (!clip.isConfigured) {
	console.log('Clip no esta configurado: nada que reconciliar.');
	process.exit(0);
}
const pb = await scriptPb();
const sales = createSalesService({ pb, getSettings: () => readSettings(() => pb), clip });

const r = await reconcileClipPayments({ pb, clip, sales });
console.log(
	`${new Date().toISOString()} revisados ${r.checked}: pagados ${r.paid}, fallidos ${r.failed}, ` +
		`pendientes ${r.pending}, con anomalia ${r.mismatch}`
);
for (const e of r.errors) console.error(`  pago ${e.payment}: ${e.error}`);
if (r.errors.length || r.mismatch) process.exit(1);
