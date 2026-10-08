#!/usr/bin/env node
/**
 * Cancela los pedidos pendientes que vencieron (no se pagaron a tiempo) y repone su stock.
 * Uso: npm run jobs:expire-orders      (programarlo con el cron del sistema, p. ej. cada 15 minutos)
 *
 * Ejemplo de crontab:  *\/15 * * * *  cd /ruta/tienda && npm run -s jobs:expire-orders >> expire.log 2>&1
 */
import { reconcileClipPayments } from '#modules/payments/reconcile.js';
import { createSalesService } from '#modules/sales/service.js';
import { readSettings } from '#modules/settings/service.js';
import { scriptClip } from '../_clip.js';
import { scriptPb } from '../_pb.js';

const pb = await scriptPb();
const clip = scriptClip();
const sales = createSalesService({ pb, getSettings: () => readSettings(() => pb), clip });

// antes de cancelar nada: un pedido pagado con tarjeta cuyo aviso se perdio no debe vencer
if (clip.isConfigured) {
	const r = await reconcileClipPayments({ pb, clip, sales });
	if (r.paid) console.log(`${new Date().toISOString()} pagos con tarjeta recuperados: ${r.paid}`);
	for (const e of r.errors)
		console.error(`  no se pudo verificar el pago ${e.payment}: ${e.error}`);
}

const { cancelled, failed } = await sales.expirePending();
console.log(`${new Date().toISOString()} pedidos vencidos cancelados: ${cancelled}`);
for (const f of failed) console.error(`  no se pudo cancelar ${f.code}: ${f.error}`);
if (failed.length) process.exit(1);
