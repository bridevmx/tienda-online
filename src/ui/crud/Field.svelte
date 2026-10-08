<script>
	import { groupOptions } from './groups.js';

	/**
	 * Un campo del formulario, segun su tipo. Los inputs no son controlados: el navegador conserva lo
	 * escrito y el servidor devuelve `values` para repintar tras un error.
	 */
	let { field, value, error, options = [], files = [], editing = false } = $props();

	const groups = $derived(groupOptions(options));
	const selected = $derived(Array.isArray(value) ? value : []);
	const locked = $derived(editing && field.immutable);
	const inputClass = $derived(`input w-full ${error ? 'input-error' : ''}`);
</script>

<div class="flex flex-col gap-1">
	<label class="text-sm font-medium" for={`f-${field.name}`}>
		{field.label}{#if field.required}<span class="text-error"> *</span>{/if}
	</label>

	{#if field.type === 'text'}
		<input
			id={`f-${field.name}`}
			class={inputClass}
			name={field.name}
			value={value ?? ''}
			placeholder={field.placeholder ?? ''}
			required={field.required}
			disabled={locked}
		/>
	{:else if field.type === 'integer'}
		<input
			id={`f-${field.name}`}
			class={inputClass}
			type="number"
			inputmode="numeric"
			step="1"
			name={field.name}
			value={value ?? ''}
			required={field.required}
		/>
	{:else if field.type === 'percent'}
		<label class="input w-full {error ? 'input-error' : ''}">
			<input
				id={`f-${field.name}`}
				name={field.name}
				inputmode="decimal"
				placeholder="0"
				value={value ?? ''}
				required={field.required}
			/>
			<span class="opacity-60">%</span>
		</label>
	{:else if field.type === 'money'}
		<label class="input w-full {error ? 'input-error' : ''}">
			<span class="opacity-60">$</span>
			<input
				id={`f-${field.name}`}
				name={field.name}
				inputmode="decimal"
				placeholder="0.00"
				value={value ?? ''}
				required={field.required}
			/>
		</label>
	{:else if field.type === 'textarea' || field.type === 'html'}
		<textarea
			id={`f-${field.name}`}
			class="textarea w-full {error ? 'textarea-error' : ''} {field.type === 'html'
				? 'font-mono text-sm'
				: ''}"
			name={field.name}
			rows={field.type === 'html' ? 8 : 4}
			required={field.required}>{value ?? ''}</textarea
		>
	{:else if field.type === 'checkbox'}
		<label class="flex items-center gap-3">
			<input
				id={`f-${field.name}`}
				type="checkbox"
				class="toggle toggle-primary"
				name={field.name}
				checked={!!value}
			/>
			<span class="text-sm opacity-70">{value ? 'Sí' : 'No'}</span>
		</label>
	{:else if field.type === 'relation'}
		<select
			id={`f-${field.name}`}
			class="select w-full {error ? 'select-error' : ''}"
			name={field.name}
			required={field.required}
			disabled={locked}
		>
			<option value="">{field.required ? 'Selecciona…' : '— Ninguna —'}</option>
			{#each options as option (option.value)}
				<option value={option.value} selected={option.value === value}>{option.label}</option>
			{/each}
		</select>
	{:else if field.type === 'groups'}
		<!-- una lista por grupo (p. ej. una por opcion: Talla, Color); cada una aporta como maximo un valor -->
		<div class="grid gap-3 sm:grid-cols-2">
			{#each groups as group (group.key)}
				<label class="flex flex-col gap-1">
					<span class="text-xs opacity-70">{group.label}</span>
					<select class="select w-full" name={field.name}>
						<option value="">—</option>
						{#each group.items as option (option.value)}
							<option value={option.value} selected={selected.includes(option.value)}>
								{option.label}
							</option>
						{/each}
					</select>
				</label>
			{/each}
		</div>
	{:else if field.type === 'relations'}
		<div class="flex flex-col gap-3">
			{#each groups as group (group.key)}
				<fieldset class="rounded-box border border-current/10 p-3">
					{#if group.label}<legend class="px-1 text-sm font-medium">{group.label}</legend>{/if}
					<div class="grid gap-2 sm:grid-cols-2">
						{#each group.items as option (option.value)}
							<label class="flex items-start gap-2">
								<input
									type="checkbox"
									class="checkbox checkbox-sm checkbox-primary mt-0.5"
									name={field.name}
									value={option.value}
									checked={selected.includes(option.value)}
								/>
								<span class="text-sm">
									{option.label}
									{#if option.hint}<span class="block text-xs opacity-60">{option.hint}</span>{/if}
								</span>
							</label>
						{/each}
					</div>
				</fieldset>
			{/each}
		</div>
	{:else if field.type === 'image' || field.type === 'images'}
		{#if files.length}
			<ul class="flex flex-wrap gap-3">
				{#each files as file (file.name)}
					<li class="flex flex-col items-center gap-1 text-xs">
						<img class="size-20 rounded-field object-cover" src={file.src} alt="" />
						<label class="flex items-center gap-1">
							<input
								type="checkbox"
								class="checkbox checkbox-xs"
								name={`remove_${field.name}`}
								value={file.name}
							/>
							Quitar
						</label>
					</li>
				{/each}
			</ul>
		{/if}
		<input
			id={`f-${field.name}`}
			type="file"
			class="file-input w-full"
			name={field.name}
			accept="image/jpeg,image/png,image/webp"
			multiple={field.type === 'images'}
		/>
	{/if}

	{#if field.help}<p class="text-xs opacity-60">{field.help}</p>{/if}
	{#if error}<p class="text-error text-sm" role="alert">{error}</p>{/if}
</div>
