import { DomainError } from '#core/errors.js';
import { allocate, computeTotals, pricingConfig } from '#core/pricing.js';
import { routes } from '#core/routes.js';
import { loadBundle } from './queries.js';
import { newAccessToken, newRecordId, orderCode, pbDate } from './ids.js';
import { placeOrderSchema } from './schema.js';
import { canTransition, orderStatusView } from './status.js';

/** Valida con Zod; lanza DomainError con el primer problema y su campo (ej. contact.email). */
function parse(schema, input) {
	const result = schema.safeParse(input);
	if (result.success) return result.data;
	const issue = result.error.issues[0];
	throw new DomainError(issue.message, { field: issue.path.join('.') || '_' });
}

/** Detalle de un fallo de batch: { index, data } o null si el error no es de un batch. */
function batchFailure(err) {
	const requests = err?.response?.requests;
	if (!requests) return null;
	const [index, failure] = Object.entries(requests)[0] ?? [];
	return index === undefined ? null : { index: Number(index), data: failure?.response?.data ?? {} };
}

const hoursFromNow = (now, hours) => new Date(now.getTime() + hours * 3_600_000);
const transferConfigured = (settings) => !!settings['transfer.clabe'];

/**
 * Servicio de ventas: crea pedidos y cambia su estado. SOLO escribe con el cliente de superusuario
 * (`pb`): las colecciones no aceptan escrituras con tokens de usuario. Quien lo llama es responsable
 * de comprobar los permisos (requirePermission) antes. Cada operacion que toca varias colecciones va
 * en un batch (transaccion): o pasa todo, o nada; el stock se descuenta con `stock-` y el limite
 * `min: 0` de la base hace fallar (y revertir) el batch si dos compradores van por la ultima pieza.
 *
 * @param {object} deps
 * @param {object} deps.pb            cliente de superusuario
 * @param {() => Promise<object>} deps.getSettings  ajustes tipados (modules/settings)
 * @param {object} deps.clip          cliente de Clip (modules/payments/clip.js)
 * @param {() => Date} [deps.now]
 */
export function createSalesService({ pb, getSettings, clip, now = () => new Date() }) {
	// ------------------------------------------------------------------ pedidos nuevos
	/** Variantes que se pueden comprar ahora: existen, estan activas y alcanza el stock. */
	async function loadPurchasable(lines) {
		const params = Object.fromEntries(lines.map((l, i) => [`v${i}`, l.variant]));
		const filter = pb.filter(lines.map((_, i) => `id = {:v${i}}`).join(' || '), params);
		const rows = await pb
			.collection('variants')
			.getFullList({ filter, expand: 'product,values.option' });
		const byId = new Map(rows.map((r) => [r.id, r]));

		return lines.map((line) => {
			const row = byId.get(line.variant);
			const product = row?.expand?.product;
			if (!row || !row.active || !product || product.active === false) {
				throw new DomainError('Alguno de los productos de tu carrito ya no está disponible', {
					field: 'lines'
				});
			}
			const options = (row.expand?.values ?? [])
				.map((ov) => ({
					sort: ov.expand?.option?.sort ?? 0,
					name: ov.expand?.option?.name ?? '',
					value: ov.value
				}))
				.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
			const label = options.map((o) => o.value).join(' / ');
			const display = label ? `${product.name} (${label})` : product.name;
			if (row.stock < line.qty) {
				throw new DomainError(
					row.stock > 0 ? `Solo quedan ${row.stock} de ${display}` : `${display} se agotó`,
					{ field: 'lines' }
				);
			}
			return { row, product, label, display, qty: line.qty };
		});
	}

	/**
	 * Crea un pedido (web o TPV): valida, recalcula TODO en el servidor, y en una sola transaccion crea
	 * pedido + finanzas + lineas + pago y descuenta el stock. Devuelve el pedido y que debe hacer el
	 * comprador: nada (ya pagado), transferir, o ir al link de pago de Clip.
	 */
	async function placeOrder(rawInput) {
		const input = parse(placeOrderSchema, rawInput);
		const settings = await getSettings();
		const config = pricingConfig(settings);

		if (input.method === 'card_clip' && !clip.isConfigured) {
			throw new DomainError('El pago con tarjeta no está disponible por el momento', {
				field: 'method'
			});
		}
		if (input.method === 'transfer' && !transferConfigured(settings)) {
			throw new DomainError('El pago por transferencia no está disponible por el momento', {
				field: 'method'
			});
		}

		const when = now();
		const paidNow = input.method === 'cash' || input.confirmNow;
		const orderId = newRecordId();
		const accessToken = newAccessToken();
		const ttlHours = settings['orders.pending_ttl_hours'];

		let code;
		let view;
		for (let attempt = 0; ; attempt++) {
			// se (re)leen existencias y precios en cada intento: pudieron cambiar mientras tanto
			const lines = await loadPurchasable(input.lines);
			const baseTotal = lines.reduce((sum, l) => sum + l.row.price * l.qty, 0);
			const totals = computeTotals({ baseCents: baseTotal, method: input.method, config });
			const { internal } = totals;
			view = totals.customerView;
			const shares = allocate(
				view.total,
				lines.map((l) => l.row.price * l.qty)
			);
			code = orderCode(input.channel, when);

			const batch = pb.createBatch();
			batch.collection('orders').create({
				id: orderId,
				code,
				channel: input.channel,
				status: paidNow ? 'paid' : 'pending',
				payment_method: input.method,
				...(input.customerId ? { customer: input.customerId } : {}),
				...(input.createdBy ? { created_by: input.createdBy } : {}),
				contact_name: input.contact.name,
				contact_email: input.contact.email,
				contact_phone: input.contact.phone,
				subtotal: view.subtotal,
				discount: view.discount,
				tax_total: view.iva,
				total: view.total,
				access_token: accessToken,
				...(paidNow
					? { paid_at: pbDate(when) }
					: { expires_at: pbDate(hoursFromNow(when, ttlHours)) })
			});
			batch.collection('order_financials').create({
				order: orderId,
				base_total: baseTotal,
				fee_total: internal.clipFee + internal.clipFeeIva,
				net_total: internal.net,
				tax_rate_bp: config.ivaBp,
				fee_rate_bp: config.feeBp,
				fee_fixed: config.feeFixed,
				tax_applied: config.applyIva,
				fee_applied: config.applyFee,
				discount_non_card: config.discountNonCard
			});
			lines.forEach((l, i) => {
				batch.collection('order_items').create({
					order: orderId,
					variant: l.row.id,
					sku: l.row.sku,
					product_name: l.product.name,
					variant_label: l.label,
					quantity: l.qty,
					unit_base: l.row.price,
					line_total: shares[i]
				});
			});
			batch.collection('payments').create({
				order: orderId,
				method: input.method,
				status: paidNow ? 'confirmed' : 'pending',
				amount: view.total,
				...(paidNow
					? {
							confirmed_at: pbDate(when),
							...(input.createdBy ? { confirmed_by: input.createdBy } : {})
						}
					: {})
			});
			const firstStockOp = 3 + lines.length; // orders, financials, items..., payment, luego el stock
			lines.forEach((l) => batch.collection('variants').update(l.row.id, { 'stock-': l.qty }));

			try {
				await batch.send();
				break;
			} catch (err) {
				const failure = batchFailure(err);
				// otro comprador se llevo la ultima pieza entre la lectura y la escritura
				if (failure && failure.index >= firstStockOp && failure.data.stock) {
					const l = lines[failure.index - firstStockOp];
					throw new DomainError(`Ya no hay suficientes piezas de ${l.display}`, {
						field: 'lines'
					});
				}
				// colision de codigo (muy improbable): se reintenta con otro
				if (failure && failure.index === 0 && failure.data.code && attempt < 4) continue;
				// transaccion abortada por escrituras simultaneas: se relee el stock y se reintenta
				if (!failure && attempt < 3 && /transaction failed/i.test(err?.message ?? '')) {
					await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
					continue;
				}
				throw err;
			}
		}

		const order = {
			id: orderId,
			code,
			accessToken,
			status: paidNow ? 'paid' : 'pending',
			total: view.total
		};

		if (input.method === 'card_clip') {
			const action = await startClipPayment({
				orderId,
				code,
				accessToken,
				total: view.total,
				origin: input.origin
			}).catch(async (err) => {
				// sin link de pago no hay pedido: se libera el stock y el comprador puede intentar otro metodo
				await cancelOrder(
					{ id: orderId },
					{ reason: 'No se pudo generar el pago con tarjeta', ifPending: true }
				).catch(() => {});
				throw new DomainError(
					'No pudimos generar el pago con tarjeta. Intenta de nuevo o elige otro método',
					{ field: 'method', cause: err }
				);
			});
			return { order, action };
		}
		if (input.method === 'transfer' && !paidNow) {
			return { order, action: { type: 'transfer', reference: code } };
		}
		return { order, action: { type: 'paid' } };
	}

	/** Crea el link de Clip del pedido y lo guarda en su pago pendiente (con la referencia firmada). */
	async function startClipPayment({ orderId, code, accessToken, total, origin }) {
		const payment = await pb
			.collection('payments')
			.getFirstListItem(pb.filter('order = {:id} && status = "pending"', { id: orderId }));
		const reference = clip.makeReference(payment.id);
		// guardar la referencia ANTES de llamar a Clip: si algo falla despues, el pago ya la tiene
		await pb.collection('payments').update(payment.id, { reference });

		const back = `${origin}${routes.order(code, accessToken)}`;
		const link = await clip.createCheckout({
			amountCents: total,
			description: `Pedido ${code}`,
			reference,
			successUrl: back,
			errorUrl: `${back}${back.includes('?') ? '&' : '?'}pago=error`,
			defaultUrl: `${origin}${routes.home()}`,
			webhookUrl: `${origin}${routes.webhooks.clip()}?token=${encodeURIComponent(clip.webhookToken)}`
		});
		await pb
			.collection('payments')
			.update(payment.id, { provider_ref: link.id, provider_url: link.url });
		return { type: 'redirect', url: link.url };
	}

	// ------------------------------------------------------------------ cambios de estado
	async function requireBundle(by) {
		const bundle = await loadBundle(pb, by);
		if (!bundle) throw new DomainError('El pedido no existe');
		return bundle;
	}

	function assertTransition(order, to) {
		if (!canTransition(order.status, to)) {
			throw new DomainError(
				`Un pedido "${orderStatusView(order.status).label.toLowerCase()}" no se puede pasar a "${orderStatusView(to).label.toLowerCase()}"`
			);
		}
	}

	/** Operaciones de stock de un batch (`stock+` repone, `stock-` descuenta) para las lineas del pedido. */
	const stockOps = (batch, items, sign) => {
		for (const item of items) {
			if (item.variant)
				batch.collection('variants').update(item.variant, { [`stock${sign}`]: item.quantity });
		}
	};

	/**
	 * Confirma un pago (pendiente -> pagado). Idempotente: si el pedido ya estaba pagado no hace nada.
	 * `paymentId` indica CUAL pago se recibio (webhook de Clip); `eventId` se guarda con indice unico
	 * para no procesar dos veces el mismo evento. Si el pago llega cuando el pedido ya se cancelo
	 * (vencio), el pedido no se reabre: se deja constancia para que el personal lo revise y reembolse.
	 */
	async function confirmPayment(
		by,
		{ by: userId = null, eventId = '', paymentId = '', receiptNo = '' } = {}
	) {
		const { order, payments, payment: current } = await requireBundle(by);
		const target = paymentId ? payments.find((p) => p.id === paymentId) : current;
		if (!target) throw new DomainError('El pedido no tiene un pago que confirmar');
		if (order.status !== 'pending' && !(order.status === 'cancelled' && paymentId)) {
			return { changed: false, order };
		}

		const when = pbDate(now());
		const batch = pb.createBatch();
		const confirmed = {
			status: 'confirmed',
			confirmed_at: when,
			...(userId ? { confirmed_by: userId } : {}),
			...(eventId ? { provider_event_id: eventId } : {}),
			...(receiptNo ? { receipt_no: receiptNo } : {})
		};
		if (order.status === 'cancelled') {
			batch.collection('payments').update(target.id, confirmed);
			batch.collection('orders').update(order.id, {
				notes: 'Pago recibido después de cancelar el pedido: revisar y reembolsar'
			});
			await batch.send();
			return { changed: true, late: true, order };
		}

		// si lo que llego no es el pago vigente (el comprador cambio de metodo), se deja constancia
		const mismatch = target.id !== current?.id || target.amount !== order.total;
		batch.collection('orders').update(order.id, {
			status: 'paid',
			paid_at: when,
			...(mismatch
				? {
						notes: `Pagado por ${target.method} por ${(target.amount / 100).toFixed(2)} (total actual ${(order.total / 100).toFixed(2)}): revisar`
					}
				: {})
		});
		batch.collection('payments').update(target.id, confirmed);
		for (const p of payments.filter((p) => p.id !== target.id && p.status === 'pending')) {
			batch.collection('payments').update(p.id, { status: 'failed' });
		}
		try {
			await batch.send();
		} catch (err) {
			// un evento repetido o una confirmacion simultanea: si ya quedo pagado, esta bien
			const fresh = await loadBundle(pb, { id: order.id });
			if (fresh?.order.status === 'paid') return { changed: false, order: fresh.order };
			throw err;
		}
		return { changed: true, order: { ...order, status: 'paid' } };
	}

	/** Cancela un pedido pendiente y repone su stock. `ifPending`: si ya no esta pendiente, no hace nada (vencimientos). */
	async function cancelOrder(by, { reason = '', ifPending = false } = {}) {
		const { order, items, payments } = await requireBundle(by);
		if (ifPending && order.status !== 'pending') return { changed: false, order };
		assertTransition(order, 'cancelled');

		const batch = pb.createBatch();
		batch.collection('orders').update(order.id, {
			status: 'cancelled',
			...(reason ? { notes: reason.slice(0, 500) } : {})
		});
		for (const p of payments.filter((p) => p.status === 'pending'))
			batch.collection('payments').update(p.id, { status: 'failed' });
		stockOps(batch, items, '+');
		await batch.send();
		return { changed: true, order: { ...order, status: 'cancelled' } };
	}

	/** Pagado -> completado (entregado). */
	async function completeOrder(by) {
		const { order } = await requireBundle(by);
		assertTransition(order, 'completed');
		await pb.collection('orders').update(order.id, { status: 'completed' });
		return { changed: true, order: { ...order, status: 'completed' } };
	}

	/** Devolucion: pagado o completado -> reembolsado, con o sin reponer stock. */
	async function refundOrder(by, { restock = false } = {}) {
		const { order, items, payments } = await requireBundle(by);
		assertTransition(order, 'refunded');
		const batch = pb.createBatch();
		batch.collection('orders').update(order.id, { status: 'refunded' });
		for (const p of payments.filter((p) => p.status === 'confirmed'))
			batch.collection('payments').update(p.id, { status: 'refunded' });
		if (restock) stockOps(batch, items, '+');
		await batch.send();
		return { changed: true, order: { ...order, status: 'refunded' } };
	}

	/**
	 * Cambia el metodo de pago de un pedido pendiente (p. ej. de tarjeta a transferencia): recalcula
	 * totales con las TASAS DE ESE PEDIDO (no las de hoy) y conserva la reserva de stock.
	 */
	async function changePaymentMethod(by, method, { origin }) {
		const settings = await getSettings();
		const { order, items, payments, financials } = await requireBundle(by);
		if (order.status !== 'pending')
			throw new DomainError('Solo se puede cambiar el método de un pedido pendiente');
		if (order.payment_method === method) return { order, action: null };
		if (order.channel === 'web' && method === 'cash')
			throw new DomainError('El efectivo solo está disponible en tienda');
		if (method === 'card_clip' && !clip.isConfigured)
			throw new DomainError('El pago con tarjeta no está disponible por el momento');
		if (method === 'transfer' && !transferConfigured(settings))
			throw new DomainError('El pago por transferencia no está disponible por el momento');
		if (!financials) throw new DomainError('No hay datos para recalcular este pedido');

		const config = {
			applyIva: financials.tax_applied,
			ivaBp: financials.tax_rate_bp,
			applyFee: financials.fee_applied,
			feeBp: financials.fee_rate_bp,
			feeFixed: financials.fee_fixed,
			discountNonCard: financials.discount_non_card
		};
		const baseTotal = items.reduce((sum, i) => sum + i.unit_base * i.quantity, 0);
		const { customerView: view, internal } = computeTotals({
			baseCents: baseTotal,
			method,
			config
		});
		const shares = allocate(
			view.total,
			items.map((i) => i.unit_base * i.quantity)
		);

		const batch = pb.createBatch();
		batch.collection('orders').update(order.id, {
			payment_method: method,
			subtotal: view.subtotal,
			discount: view.discount,
			tax_total: view.iva,
			total: view.total
		});
		batch.collection('order_financials').update(financials.id, {
			fee_total: internal.clipFee + internal.clipFeeIva,
			net_total: internal.net
		});
		items.forEach((item, i) =>
			batch.collection('order_items').update(item.id, { line_total: shares[i] })
		);
		for (const p of payments.filter((p) => p.status === 'pending'))
			batch.collection('payments').update(p.id, { status: 'failed' });
		batch
			.collection('payments')
			.create({ order: order.id, method, status: 'pending', amount: view.total });
		await batch.send();

		if (method === 'card_clip') {
			const action = await startClipPayment({
				orderId: order.id,
				code: order.code,
				accessToken: order.access_token,
				total: view.total,
				origin
			});
			return { order: { ...order, payment_method: method, total: view.total }, action };
		}
		return {
			order: { ...order, payment_method: method, total: view.total },
			action: { type: 'transfer', reference: order.code }
		};
	}

	/** Deja una nota en un pago (anomalias que el personal debe revisar). No cambia estados. */
	async function notePayment(paymentId, note) {
		await pb
			.collection('payments')
			.update(paymentId, { provider_note: String(note).slice(0, 255) });
	}

	/** Marca como fallido UN intento de pago pendiente (p. ej. Clip cancelo o vencio ese link). */
	async function failPayment(paymentId) {
		const payment = await pb.collection('payments').getOne(paymentId);
		if (payment.status !== 'pending') return { changed: false };
		await pb.collection('payments').update(payment.id, { status: 'failed' });
		return { changed: true };
	}

	/** Cancela los pedidos pendientes que vencieron (los ejecuta un script con cron, no un hook). */
	async function expirePending({ limit = 200 } = {}) {
		const due = await pb.collection('orders').getList(1, limit, {
			filter: pb.filter('status = "pending" && expires_at != "" && expires_at < {:now}', {
				now: pbDate(now())
			}),
			sort: 'expires_at'
		});
		const result = { cancelled: 0, failed: [] };
		for (const order of due.items) {
			try {
				const out = await cancelOrder(
					{ id: order.id },
					{ reason: 'Venció el tiempo para pagar', ifPending: true }
				);
				if (out.changed) result.cancelled += 1;
			} catch (err) {
				result.failed.push({ code: order.code, error: err.message });
			}
		}
		return result;
	}

	return {
		placeOrder,
		confirmPayment,
		cancelOrder,
		completeOrder,
		refundOrder,
		changePaymentMethod,
		failPayment,
		notePayment,
		expirePending,
		bundle: (by) => loadBundle(pb, by)
	};
}
