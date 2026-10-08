import net from 'node:net';

/**
 * Servidor SMTP minimo que guarda los correos que envia PocketBase (verificacion, recuperacion,
 * cambio de correo) para que las pruebas lean los enlaces. Solo implementa lo que PocketBase usa.
 */
export async function startSmtpSink() {
	const messages = [];
	const server = net.createServer((socket) => {
		let buffer = '';
		let inData = false;
		let mail = { from: '', to: [], data: '' };
		const reply = (line) => socket.write(`${line}\r\n`);
		reply('220 sink ESMTP');
		socket.on('data', (chunk) => {
			buffer += chunk.toString('utf8');
			for (;;) {
				if (inData) {
					const end = buffer.indexOf('\r\n.\r\n');
					if (end === -1) return;
					mail.data = buffer.slice(0, end);
					buffer = buffer.slice(end + 5);
					inData = false;
					messages.push({ ...mail, raw: mail.data });
					mail = { from: '', to: [], data: '' };
					reply('250 OK queued');
					continue;
				}
				const eol = buffer.indexOf('\r\n');
				if (eol === -1) return;
				const line = buffer.slice(0, eol);
				buffer = buffer.slice(eol + 2);
				const cmd = line.slice(0, 4).toUpperCase();
				if (cmd === 'EHLO' || cmd === 'HELO') reply('250 sink');
				else if (cmd === 'MAIL') ((mail.from = line), reply('250 OK'));
				else if (cmd === 'RCPT')
					(mail.to.push(line.replace(/^RCPT TO:\s*<?|>?\s*$/gi, '')), reply('250 OK'));
				else if (cmd === 'DATA') ((inData = true), reply('354 go'));
				else if (cmd === 'QUIT') (reply('221 bye'), socket.end());
				else reply('250 OK');
			}
		});
		socket.on('error', () => {});
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address();

	return {
		url: `smtp://127.0.0.1:${port}`,
		port,
		messages,
		stop: () => new Promise((resolve) => server.close(resolve)),
		/** Apunta PocketBase a este servidor SMTP y fija la URL publica de la tienda (enlaces de los correos). */
		async configurePocketBase(pbUrl, superuser, appUrl) {
			const auth = await fetch(`${pbUrl}/api/collections/_superusers/auth-with-password`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ identity: superuser.email, password: superuser.password })
			}).then((r) => r.json());
			const res = await fetch(`${pbUrl}/api/settings`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', authorization: auth.token },
				body: JSON.stringify({
					meta: {
						appName: 'Tienda',
						appURL: appUrl,
						senderName: 'Tienda',
						senderAddress: 'tienda@test.local'
					},
					smtp: { enabled: true, host: '127.0.0.1', port, tls: false, authMethod: '' }
				})
			});
			if (!res.ok) throw new Error(`No pude configurar SMTP en PocketBase: ${await res.text()}`);
		}
	};
}
