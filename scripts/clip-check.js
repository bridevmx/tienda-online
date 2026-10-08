#!/usr/bin/env node
/**
 * Verificador manual de Clip, SIN la tienda: crea un link de pago real, lo muestra y (con --wait) espera a
 * que lo pagues para comprobar lo mismo que la tienda exige antes de dar un pago por bueno: estado
 * COMPLETADO, referencia, monto, moneda y receipt_no. Sirve para validar credenciales, el formato de la
 * API y el cobro real con un monto bajo.
 *
 * Uso:
 *   npm run clip:check                       crea un link de $1.00 y lo imprime
 *   npm run clip:check -- --wait             ...y espera a que se pague (hasta 10 min)
 *   npm run clip:check -- --amount 5 --wait  otro monto (pesos, minimo 1)
 *   npm run clip:check -- --id <uuid>        consulta un link ya creado (sin crear nada)
 *
 * Lee CLIP_* de .env (igual que la tienda). Los links caducan solos (3 dias por defecto).
 */
import { randomBytes } from 'node:crypto';
import { checkoutReport, reportPasses } from '#modules/payments/check.js';
import { scriptClip } from './_clip.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const clip = scriptClip();
if (!clip.isConfigured) {
	console.error(
		'Clip no esta configurado: define CLIP_API_TOKEN (o CLIP_API_KEY + CLIP_API_SECRET) y CLIP_WEBHOOK_TOKEN en .env'
	);
	process.exit(2);
}

const mark = (ok) => (ok ? '✓' : '✗');
const show = (report) =>
	report.forEach((c) => console.log(`  ${mark(c.ok)} ${c.name} — ${c.detail}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fail(err) {
	console.error(`\nError: ${err.message}`);
	if (err.status === 401)
		console.error(
			'  → Revisa las credenciales y el formato del header Authorization (token vs Basic).'
		);
	if (err.status === 403)
		console.error(
			'  → Clip bloquea solicitudes desde fuera de Mexico/EE. UU. (revisa VPN o region).'
		);
	process.exit(1);
}

try {
	if (option('id')) {
		const remote = await clip.getCheckout(option('id'));
		console.log(
			`Estado: ${remote.rawStatus} · monto ${remote.amountCents} centavos · ${remote.currency}`
		);
		console.log(
			`Referencia: ${remote.reference ?? '(ninguna)'} · receipt_no: ${remote.receiptNo ?? '(aun no)'}`
		);
		process.exit(0);
	}

	const pesos = Number(option('amount', '1'));
	if (!(pesos >= 1)) throw new Error('El monto minimo de Clip es 1 peso');
	const amountCents = Math.round(pesos * 100);
	const base = option('base', process.env.PUBLIC_URL || 'http://localhost:3000').replace(
		/\/+$/,
		''
	);
	// misma forma que las referencias de la tienda (TDA-<id>-<firma>), con un id de prueba
	const id15 = randomBytes(12).toString('hex').slice(0, 15);
	const reference = clip.makeReference(id15);

	console.log(`Creando link de pago por $${pesos.toFixed(2)} MXN…`);
	const link = await clip.createCheckout({
		amountCents,
		description: `Prueba clip:check ${new Date().toISOString()}`,
		reference,
		successUrl: `${base}/?clip=ok`,
		errorUrl: `${base}/?clip=error`,
		defaultUrl: `${base}/`
	});
	console.log('✓ Clip acepto las credenciales y el cuerpo de la solicitud');
	console.log(`  id:         ${link.id}`);
	console.log(`  referencia: ${reference}`);
	console.log(`  pagar en:   ${link.url}`);

	const first = await clip.getCheckout(link.id);
	console.log(`\nConsulta inmediata (GET): estado ${first.rawStatus}`);
	show(
		checkoutReport(first, { reference, amountCents }).filter(
			(c) => c.name !== 'estado COMPLETADO' && c.name !== 'receipt_no presente'
		)
	);

	if (!flag('wait')) {
		console.log(
			`\nPara esperar el pago: npm run clip:check -- --wait   (o consulta luego: --id ${link.id})`
		);
		process.exit(0);
	}

	console.log('\nAbre el link, paga y espero el resultado (Ctrl+C para salir)…');
	let last = first.rawStatus;
	const deadline = Date.now() + 10 * 60_000;
	while (Date.now() < deadline) {
		await sleep(3000);
		const remote = await clip.getCheckout(link.id);
		if (remote.rawStatus !== last) {
			console.log(`${new Date().toLocaleTimeString()} estado: ${last} → ${remote.rawStatus}`);
			last = remote.rawStatus;
		}
		if (remote.status !== 'pending') {
			console.log('\nResultado final:');
			const report = checkoutReport(remote, { reference, amountCents });
			show(report);
			if (remote.status === 'failed') console.log('\nEl link fallo, vencio o se cancelo en Clip.');
			process.exit(reportPasses(report) ? 0 : 1);
		}
	}
	console.log('Se acabo el tiempo de espera sin que se pagara.');
	process.exit(1);
} catch (err) {
	await fail(err);
}
