import sanitizeHtml from 'sanitize-html';

/**
 * Sanea el HTML que escribe el personal (descripcion de producto) antes de mostrarlo a clientes:
 * solo etiquetas de texto basicas; sin scripts, estilos, eventos ni imagenes; enlaces seguros.
 */
const OPTIONS = {
	allowedTags: [
		'p',
		'br',
		'ul',
		'ol',
		'li',
		'strong',
		'b',
		'em',
		'i',
		'u',
		'h2',
		'h3',
		'h4',
		'blockquote',
		'a'
	],
	allowedAttributes: { a: ['href', 'title', 'rel', 'target'] },
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowProtocolRelative: false,
	transformTags: {
		a: (tag, attribs) => ({
			tagName: 'a',
			attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' }
		})
	},
	disallowedTagsMode: 'discard'
};

export function sanitizeDescription(html) {
	return sanitizeHtml(String(html ?? ''), OPTIONS);
}

/** Texto plano (sin etiquetas) para meta descripciones. */
export function stripHtml(html, max = 160) {
	const text = sanitizeHtml(String(html ?? ''), { allowedTags: [], allowedAttributes: {} })
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
