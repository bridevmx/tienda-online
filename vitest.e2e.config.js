import { defineConfig } from 'vitest/config';

/**
 * Pruebas de extremo a extremo en un navegador real (Playwright + Chromium) sobre la misma pila
 * de las de integracion (PocketBase temporal + servidor compilado + dobles de Clip y SMTP).
 * `npm run test:e2e`. Necesitan el binario de PocketBase y Chromium (PLAYWRIGHT_BROWSERS_PATH).
 */
export default defineConfig({
	test: {
		include: ['tests/e2e/**/*.test.js'],
		globalSetup: ['tests/integration/global-setup.js'],
		fileParallelism: false,
		testTimeout: 60_000,
		hookTimeout: 180_000,
		environment: 'node'
	}
});
