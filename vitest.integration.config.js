import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integracion: levantan un PocketBase temporal y el servidor compilado (build/) y prueban
 * los flujos reales por HTTP. Necesitan el binario (`npm run pb:download`). `npm run test:integration`.
 */
export default defineConfig({
	test: {
		include: ['tests/integration/**/*.test.js'],
		globalSetup: ['tests/integration/global-setup.js'],
		fileParallelism: false, // comparten una sola instancia de PocketBase
		testTimeout: 60_000,
		hookTimeout: 180_000,
		environment: 'node'
	}
});
