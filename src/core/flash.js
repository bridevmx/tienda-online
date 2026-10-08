/** Mensaje de una sola vez tras una accion (Post/Redirect/Get): se guarda en una cookie y se lee una vez. */
const COOKIE = 'flash';

export function setFlash(cookies, { type = 'info', text }) {
	cookies.set(COOKIE, JSON.stringify({ type, text }), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60
	});
}

export function takeFlash(cookies) {
	const raw = cookies.get(COOKIE);
	if (!raw) return null;
	cookies.delete(COOKIE, { path: '/' });
	try {
		const flash = JSON.parse(raw);
		if (typeof flash?.text !== 'string') return null;
		return { type: flash.type === 'error' ? 'error' : 'info', text: flash.text.slice(0, 200) };
	} catch {
		return null;
	}
}
