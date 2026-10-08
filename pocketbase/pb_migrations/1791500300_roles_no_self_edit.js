/// <reference path="../pb_data/types.d.ts" />
/**
 * Endurecimiento: nadie puede editar el rol que tiene asignado. Sin esto, alguien con `roles:update`
 * podria darse a si mismo cualquier permiso (escalada de privilegios).
 */
migrate(
	(app) => {
		const roles = app.findCollectionByNameOrId('roles');
		roles.updateRule = `${roles.updateRule} && id != @request.auth.role`;
		app.save(roles);
	},
	(app) => {
		const roles = app.findCollectionByNameOrId('roles');
		roles.updateRule = roles.updateRule.replace(' && id != @request.auth.role', '');
		app.save(roles);
	}
);
