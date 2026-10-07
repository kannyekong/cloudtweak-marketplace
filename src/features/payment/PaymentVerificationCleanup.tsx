import { onMount } from 'solid-js';

import { clearCart } from '~/lib/tweakmart/cart.ts';

/* Clears the completed checkout cart after Paystack returns with a verification issue. */
export default function PaymentVerificationCleanup() {
	onMount(() => {
		clearCart();
	});

	return null;
}
