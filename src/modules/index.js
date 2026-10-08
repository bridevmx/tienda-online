import access from './access/index.js';
import catalog from './catalog/index.js';
import settings from './settings/index.js';

/**
 * Registro de modulos. Para agregar uno: crear src/modules/<nombre>/index.js con
 * `defineModule(...)` e importarlo aqui. Es el unico archivo que hay que tocar.
 */
export const modules = [access, catalog, settings];
