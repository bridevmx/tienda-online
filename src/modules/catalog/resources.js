import { defineResource } from '#core/resource.js';
import {
	categorySchema,
	optionSchema,
	optionValueSchema,
	productSchema,
	variantSchema
} from './schema.js';
import { createCatalogService } from './service.js';

const perms = (name) => ({
	read: `${name}:read`,
	create: `${name}:create`,
	update: `${name}:update`,
	delete: `${name}:delete`
});

/** Reglas propias del catalogo (un nivel de categorias, integridad de variantes) sobre el CRUD generico. */
const withCatalogService = (key) => (pb) => {
	const service = createCatalogService(pb)[key];
	return {
		create: (input, extras) => service.create(input, extras),
		update: (id, input, extras) => service.update(id, input, extras)
	};
};

const categoryLabel = (r) => (r.expand?.parent ? `${r.expand.parent.name} › ${r.name}` : r.name);

export const categories = defineResource({
	name: 'categories',
	feminine: true,
	label: ['Categoría', 'Categorías'],
	permissions: perms('categories'),
	schema: categorySchema,
	columns: [
		{ key: 'image', label: '', type: 'image' },
		{ key: 'name', label: 'Nombre', sortable: true },
		{ key: 'slug', label: 'Identificador', type: 'muted' },
		{ key: 'parent', label: 'Categoría padre', type: 'relation', labelKey: 'name' },
		{ key: 'sort', label: 'Orden', type: 'integer', sortable: true },
		{ key: 'active', label: 'Estado', type: 'bool', labels: ['Activa', 'Inactiva'] }
	],
	fields: [
		{ name: 'name', label: 'Nombre', type: 'text', required: true },
		{
			name: 'slug',
			label: 'Identificador',
			type: 'text',
			help: 'Aparece en la URL. Déjalo vacío para generarlo del nombre.'
		},
		{
			name: 'parent',
			label: 'Categoría padre',
			type: 'relation',
			help: 'Solo se permite un nivel de subcategorías.',
			options: {
				collection: 'categories',
				filter: 'parent = ""',
				sort: 'sort,name',
				label: (r) => r.name
			}
		},
		{ name: 'sort', label: 'Orden', type: 'integer', help: 'Menor número aparece primero.' },
		{ name: 'image', label: 'Imagen', type: 'image' },
		{ name: 'active', label: 'Visible en la tienda', type: 'checkbox' }
	],
	search: ['name', 'slug'],
	defaultSort: 'sort,name',
	expand: 'parent',
	filters: [
		{ name: 'parent', type: 'relation', label: 'Categoría padre' },
		{ name: 'active', type: 'bool', label: 'Activa' }
	],
	service: withCatalogService('categories')
});

export const products = defineResource({
	name: 'products',
	label: ['Producto', 'Productos'],
	permissions: perms('products'),
	schema: productSchema,
	columns: [
		{ key: 'images', label: '', type: 'image' },
		{ key: 'name', label: 'Producto', sortable: true },
		{ key: 'category', label: 'Categoría', type: 'relation', labelKey: 'name' },
		{ key: 'active', label: 'Estado', type: 'bool', labels: ['Activo', 'Inactivo'] },
		{ key: 'created', label: 'Creado', type: 'date', sortable: true }
	],
	fields: [
		{ name: 'name', label: 'Nombre', type: 'text', required: true },
		{
			name: 'slug',
			label: 'Identificador',
			type: 'text',
			help: 'Aparece en la URL. Déjalo vacío para generarlo del nombre.'
		},
		{
			name: 'category',
			label: 'Categoría',
			type: 'relation',
			required: true,
			options: { collection: 'categories', sort: 'name', expand: 'parent', label: categoryLabel }
		},
		{
			name: 'description',
			label: 'Descripción',
			type: 'html',
			help: 'Acepta HTML básico (<p>, <ul>, <strong>).'
		},
		{
			name: 'images',
			label: 'Imágenes',
			type: 'images',
			help: 'JPG, PNG o WebP, hasta 5 MB cada una.'
		},
		{ name: 'active', label: 'Visible en la tienda', type: 'checkbox' }
	],
	search: ['name', 'slug'],
	defaultSort: '-created',
	expand: 'category',
	filters: [
		{ name: 'category', type: 'relation', label: 'Categoría' },
		{ name: 'active', type: 'bool', label: 'Activo' }
	],
	children: [{ resource: 'variants', foreignKey: 'product', label: 'Variantes' }],
	service: withCatalogService('products')
});

export const options = defineResource({
	name: 'options',
	feminine: true,
	label: ['Opción', 'Opciones'],
	permissions: perms('options'),
	schema: optionSchema,
	columns: [
		{ key: 'name', label: 'Opción', sortable: true },
		{ key: 'sort', label: 'Orden', type: 'integer', sortable: true }
	],
	fields: [
		{ name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Talla, Color…' },
		{
			name: 'sort',
			label: 'Orden',
			type: 'integer',
			help: 'Orden en que se muestran las opciones.'
		}
	],
	search: ['name'],
	defaultSort: 'sort,name',
	children: [{ resource: 'option_values', foreignKey: 'option', label: 'Valores' }]
});

export const optionValues = defineResource({
	name: 'option_values',
	label: ['Valor', 'Valores'],
	permissions: perms('options'),
	schema: optionValueSchema,
	titleField: 'value',
	hidden: true, // se administran desde la opcion
	columns: [
		{ key: 'value', label: 'Valor' },
		{ key: 'option', label: 'Opción', type: 'relation', labelKey: 'name' },
		{ key: 'sort', label: 'Orden', type: 'integer', sortable: true }
	],
	fields: [
		{
			name: 'option',
			label: 'Opción',
			type: 'relation',
			required: true,
			prefill: true,
			immutable: true,
			options: { collection: 'options', sort: 'sort,name', label: (r) => r.name }
		},
		{ name: 'value', label: 'Valor', type: 'text', required: true, placeholder: 'M, Rojo…' },
		{ name: 'sort', label: 'Orden', type: 'integer' }
	],
	search: ['value'],
	defaultSort: 'sort',
	expand: 'option',
	filters: [{ name: 'option', type: 'relation', label: 'Opción' }]
});

export const variants = defineResource({
	name: 'variants',
	feminine: true,
	label: ['Variante', 'Variantes'],
	permissions: perms('variants'),
	schema: variantSchema,
	titleField: 'sku',
	columns: [
		{ key: 'image', label: '', type: 'image' },
		{ key: 'sku', label: 'SKU', type: 'code', sortable: true },
		{ key: 'product', label: 'Producto', type: 'relation', labelKey: 'name' },
		{ key: 'values', label: 'Opciones', type: 'relations', labelKey: 'value' },
		{ key: 'price', label: 'Precio', type: 'money', sortable: true },
		{ key: 'stock', label: 'Stock', type: 'stock', sortable: true },
		{ key: 'active', label: 'Estado', type: 'bool', labels: ['Activa', 'Inactiva'] }
	],
	fields: [
		{
			name: 'product',
			label: 'Producto',
			type: 'relation',
			required: true,
			prefill: true,
			immutable: true,
			options: { collection: 'products', sort: 'name', label: (r) => r.name }
		},
		{
			name: 'sku',
			label: 'SKU',
			type: 'text',
			required: true,
			help: 'Único. Letras, números, punto y guiones.'
		},
		{
			name: 'barcode',
			label: 'Código de barras',
			type: 'text',
			help: 'Opcional, único. Lo usa el TPV.'
		},
		{
			name: 'price',
			label: 'Precio (MXN)',
			type: 'money',
			required: true,
			help: 'Lo que quieres recibir, sin IVA ni comisión.'
		},
		{ name: 'stock', label: 'Stock', type: 'integer', required: true },
		{
			name: 'values',
			label: 'Opciones',
			type: 'groups',
			help: 'Una por opción. Todas las variantes del producto deben usar las mismas opciones.',
			options: {
				collection: 'option_values',
				sort: 'sort',
				expand: 'option',
				label: (r) => r.value,
				group: (r) => ({ key: r.option, label: r.expand?.option?.name ?? r.option })
			}
		},
		{
			name: 'image',
			label: 'Imagen',
			type: 'image',
			help: 'Opcional; si no hay, se usa la del producto.'
		},
		{ name: 'active', label: 'Disponible para la venta', type: 'checkbox' }
	],
	search: ['sku', 'barcode', 'product.name'],
	defaultSort: '-created',
	expand: 'product,values',
	filters: [
		{ name: 'product', type: 'relation', label: 'Producto' },
		{ name: 'active', type: 'bool', label: 'Activa' }
	],
	service: withCatalogService('variants')
});

export const resources = [categories, products, options, optionValues, variants];
