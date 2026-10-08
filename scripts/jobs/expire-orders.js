#!/usr/bin/env node
/**
 * Cancela los pedidos pendientes que vencieron (no se pagaron a tiempo) y repone su stock.
 * Uso: npm run jobs:expire-orders      (programarlo con el cron del sistema, p. ej. cada 15 minutos)
 *
 * Ejemplo de crontab:  *\/15 * * * *  cd /ruta/tienda && npm run -s jobs:expire-orders >> expire.log 2>&1
 */
import { createSalesService } from '#modules/sales/service.js';
import { readSettings } from '#modules/settings/service.js';
import { scriptPb } from '../_pb.js';

const pb = await scriptPb();
// este trabajo no usa Clip (solo cancela y repone stock)
const clip = { isConfigured: false, webhookToken: '' };
const sales = createSalesService({ pb, getSettings: () => readSettings(() => pb), clip });

const { cancelled, failed } = await sales.expirePending();
console.log(`${new Date().toISOString()} pedidos vencidos cancelados: ${cancelled}`);
for (const f of failed) console.error(`  no se pudo cancelar ${f.code}: ${f.error}`);
if (failed.length) process.exit(1);
