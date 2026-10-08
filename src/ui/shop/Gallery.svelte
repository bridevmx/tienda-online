<script>
	/** Imagen principal con miniaturas. Sin imagenes: un marcador con la inicial. */
	let { images, name } = $props();
	let current = $state(0);
	const main = $derived(images[current] ?? images[0]);
</script>

<div class="flex flex-col gap-3">
	<div class="aspect-square overflow-hidden rounded-box border border-current/10 bg-current/5">
		{#if main}
			<img class="size-full object-cover" src={main.src} alt={name} />
		{:else}
			<div
				class="flex size-full items-center justify-center text-7xl opacity-30"
				aria-hidden="true"
			>
				{name.slice(0, 1)}
			</div>
		{/if}
	</div>
	{#if images.length > 1}
		<ul class="flex gap-2 overflow-x-auto">
			{#each images as image, i (image.src)}
				<li>
					<button
						type="button"
						class="block overflow-hidden rounded-field border-2 {i === current
							? 'border-primary'
							: 'border-transparent'}"
						aria-label={`Ver imagen ${i + 1}`}
						aria-current={i === current}
						onclick={() => (current = i)}
					>
						<img class="size-16 object-cover" src={image.thumb} alt="" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
