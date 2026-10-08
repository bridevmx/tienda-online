import { afterAll, beforeAll, describe, it } from 'vitest';
import { enabled, expect, launch, loginStaff, noBrowserErrors } from './support.js';
import { saveSettings, staff } from '../integration/support.js';

describe.skipIf(!enabled)('navegador: tienda, admin y TPV', () => {
	let app;
	beforeAll(async () => {
		app = await launch();
		const boss = await staff('boss');
		await saveSettings(boss, {
			'transfer.beneficiary': 'Mi Tienda SA',
			'transfer.bank': 'Banco Prueba',
			'transfer.clabe': '012345678901234567'
		});
	});
	afterAll(async () => {
		await app?.close();
		await saveSettings(await staff('boss'));
	});

	it('tienda: del producto al pedido por transferencia, sin ver comisiones', async () => {
		const page = await app.page();
		await page.goto('/productos');
		await page.click('a:has-text("Taza de cerámica")');
		await expect(page.locator('h1')).toContainText('Taza de cerámica');
		expect(await page.content()).not.toMatch(/comisi/i);
		expect(await page.getByText('solo personal').count()).toBe(0);

		await page.click('button:has-text("Agregar al carrito")');
		await page.goto('/carrito');
		await expect(page.getByText('Taza de cerámica').first()).toBeVisible();
		await page.click('a:has-text("Continuar con la compra")');

		await page.fill('input[name=name]', 'Ana Navegador');
		await page.fill('input[name=email]', 'ana.nav@correo.test');
		await page.check('input[name=method][value=transfer]');
		await page.click('button:has-text("Confirmar pedido")');
		await page.waitForURL(/\/pedido\//);
		await expect(page.getByTestId('order-status')).toContainText('Pendiente de pago');
		await expect(page.getByText('012345678901234567')).toBeVisible();
		noBrowserErrors(app.errors);
	});

	it('admin: el personal crea una categoría desde el formulario', async () => {
		const page = await app.page();
		await loginStaff(page, 'boss');
		await page.goto('/admin/categories/nuevo');
		await page.fill('input[name=name]', 'Categoría E2E');
		await page.click('button.btn-primary');
		await page.waitForURL(/\/admin\/categories\/[a-z0-9]{15}/); // al crear se abre su edición
		await page.goto('/admin/categories');
		await expect(page.locator('tbody').getByText('Categoría E2E').first()).toBeVisible();
		noBrowserErrors(app.errors);
	});

	it('TPV: escanear SKU, cobrar en efectivo y ver el cambio en el ticket', async () => {
		const page = await app.page();
		await loginStaff(page, 'caja', '/tpv');
		await page.waitForURL('**/tpv');
		await expect(page.getByLabel('Buscar producto')).toBeFocused();

		// lector de codigos: SKU exacto + Enter agrega al ticket y limpia el buscador
		await page.getByLabel('Buscar producto').fill('taz-cer');
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('pos-ticket')).toContainText('Taza de cerámica');
		await expect(page.getByLabel('Buscar producto')).toHaveValue('');
		await page.getByLabel('Agregar uno').click();
		await expect(page.getByTestId('pos-ticket')).toContainText('2');

		// busqueda por texto sin acentos y clic en la tarjeta
		await page.getByLabel('Buscar producto').fill('gorra');
		await page.locator('[data-sku="GOR-NEG"]').click();
		await expect(page.getByTestId('pos-ticket')).toContainText('Gorra');

		await page.getByTestId('pos-charge').click();
		await expect(page.getByTestId('pos-due')).toBeVisible();
		await page.getByTestId('pos-received').fill('2000');
		await expect(page.getByTestId('pos-change')).toContainText('Cambio');
		await page.getByTestId('pos-confirm').click();

		await page.waitForURL(/\/tpv\/ventas\/[A-Z]-/);
		await expect(page.getByTestId('ticket')).toContainText('Taza de cerámica');
		await expect(page.getByTestId('ticket-change')).toBeVisible();
		expect(await page.content()).not.toMatch(/comisi/i);

		await page.goto('/tpv/ventas');
		await expect(page.getByTestId('shift-orders')).toBeVisible();
		noBrowserErrors(app.errors);
	});

	it('TPV: no permite cobrar menos de lo debido ni más de lo que hay', async () => {
		const page = await app.page();
		await loginStaff(page, 'caja', '/tpv');
		await page.getByLabel('Buscar producto').fill('taz-cer');
		await page.keyboard.press('Enter');
		await page.getByTestId('pos-charge').click();
		await page.getByTestId('pos-received').fill('1');
		await expect(page.getByTestId('pos-confirm')).toBeDisabled();
		await expect(page.getByTestId('pos-change')).toContainText('Faltan');
	});
});
