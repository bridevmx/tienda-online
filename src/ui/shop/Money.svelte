<script>
	import { formatMoney } from '#core/money.js';

	let { cents } = $props();
</script>

<span class="tabular-nums">{formatMoney(cents)}</span>
