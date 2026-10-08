import { modules } from '#modules/index.js';
import { collectResources } from './resource.js';

/** Todos los recursos administrables (Map nombre -> recurso), validados al arrancar. Solo servidor. */
export const resources = collectResources(modules);

export { modules };
