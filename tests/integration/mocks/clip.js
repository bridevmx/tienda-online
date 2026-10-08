import http from 'node:http';

/**
 * Doble de la API de Clip para las pruebas. Se completa en la fase 6 (links de pago y consulta de
 * estado); por ahora solo levanta el servidor.
 */
export async function startClipMock() {
	const server = http.createServer((req, res) => {
		res.writeHead(404, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: 'not implemented' }));
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	return {
		url: `http://127.0.0.1:${server.address().port}`,
		stop: () => new Promise((resolve) => server.close(resolve))
	};
}
