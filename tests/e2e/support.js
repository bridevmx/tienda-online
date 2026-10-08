import { chromium, expect } from '@playwright/test';
import { inject } from 'vitest';

/** Aserciones de Playwright (con reintentos) para localizadores y paginas. */
export { expect };

export const cfg = inject('it');
export const enabled = !!cfg;

/** Abre Chromium y devuelve helpers; cada prueba pide un contexto aislado (cookies propias). */
export async function launch() {
	const browser = await chromium.launch();
	const errors = [];
	return {
		browser,
		errors,
		async page() {
			const context = await browser.newContext({ baseURL: cfg.webUrl, locale: 'es-MX' });
			// la tienda corre en http plano detras de "proxy": se declara el protocolo como en las otras pruebas
			await context.setExtraHTTPHeaders({ 'x-forwarded-proto': 'http' });
			const page = await context.newPage();
			page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
			page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
			return page;
		},
		close: () => browser.close()
	};
}

export async function loginStaff(page, who, next = '/admin') {
	const user = cfg.users[who];
	await page.goto(`/admin/entrar?next=${encodeURIComponent(next)}`);
	await page.fill('input[name=email]', user.email);
	await page.fill('input[name=password]', user.password);
	await page.click('button:has-text("Entrar")');
	await page.waitForURL((url) => !url.pathname.startsWith('/admin/entrar'));
}

/** Sin errores de JavaScript en consola durante la prueba. */
export const noBrowserErrors = (errors) => expect(errors, errors.join('\n')).toEqual([]);
