import { describe, expect, it } from 'vitest';
import { sanitizeDescription, stripHtml } from './html.js';

describe('sanitizeDescription', () => {
	it('conserva formato basico', () => {
		expect(sanitizeDescription('<p>Hola <strong>mundo</strong></p><ul><li>a</li></ul>')).toBe(
			'<p>Hola <strong>mundo</strong></p><ul><li>a</li></ul>'
		);
	});
	it('elimina scripts, eventos, estilos, iframes e imagenes', () => {
		const dirty =
			'<p onclick="x()">a</p><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="//evil"></iframe><style>*{}</style><div style="x">b</div>';
		const clean = sanitizeDescription(dirty);
		for (const bad of ['script', 'onclick', 'onerror', 'iframe', 'style', '<img', 'alert']) {
			expect(clean.toLowerCase(), bad).not.toContain(bad);
		}
		expect(clean).toContain('<p>a</p>');
	});
	it('enlaces: solo esquemas seguros y con rel/target', () => {
		expect(sanitizeDescription('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript');
		expect(sanitizeDescription('<a href="data:text/html;base64,AAA">x</a>')).not.toContain('data:');
		expect(sanitizeDescription('<a href="//evil.com">x</a>')).not.toContain('evil.com');
		const ok = sanitizeDescription('<a href="https://ejemplo.com">x</a>');
		expect(ok).toContain('href="https://ejemplo.com"');
		expect(ok).toContain('rel="noopener noreferrer nofollow"');
	});
	it('tolera valores vacios', () => {
		expect(sanitizeDescription(undefined)).toBe('');
		expect(sanitizeDescription(null)).toBe('');
	});
});

describe('stripHtml', () => {
	it('texto plano recortado', () => {
		expect(stripHtml('<p>Hola <b>mundo</b></p>')).toBe('Hola mundo');
		expect(stripHtml('x'.repeat(300), 50)).toHaveLength(50);
	});
});
