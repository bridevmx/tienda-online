import { fail } from '@sveltejs/kit';
import { DomainError } from '#core/errors.js';
import { requirePermission } from '#core/guards.js';
import { setFlash } from '#core/flash.js';
import { formDataToObject } from '#core/validate.js';
import { GROUPS, SETTINGS, toFormValue } from '#modules/settings/registry.js';
import { createSettingsService } from '#modules/settings/service.js';

const FIELD_TYPE = {
	boolean: 'checkbox',
	percent: 'percent',
	money: 'money',
	integer: 'integer',
	text: 'text',
	textarea: 'textarea'
};

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url }) {
	requirePermission(locals, url, 'settings:read');
	const values = await createSettingsService(locals.pb).values();
	return {
		canUpdate: locals.permissions.has('settings:update'),
		groups: GROUPS.map((group) => ({
			...group,
			fields: SETTINGS.filter((def) => def.group === group.id).map((def) => ({
				name: def.key,
				label: def.label,
				type: FIELD_TYPE[def.type],
				help: def.help,
				required: !!def.required,
				value: toFormValue(def, values[def.key])
			}))
		}))
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, url, cookies }) => {
		requirePermission(locals, url, 'settings:update');
		const raw = formDataToObject(await request.formData());
		try {
			const changed = await createSettingsService(locals.pb).save(raw);
			setFlash(cookies, {
				text: changed.length ? 'Ajustes guardados' : 'No hubo cambios que guardar'
			});
		} catch (err) {
			if (!(err instanceof DomainError)) throw err;
			return fail(400, { errors: { [err.field]: err.message }, values: raw });
		}
		return { saved: true };
	}
};
