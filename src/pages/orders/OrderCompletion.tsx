import { onMount } from 'solid-js';

import { clearCart } from '~/lib/tweakmart/cart.ts';

interface OrderCompletionProps {
	clearCompletedCart?: boolean;
}

/* Clears the completed browser cart after a confirmed order flow reaches this page. */
export default function OrderCompletion(props: OrderCompletionProps) {
	onMount(() => {
		if (!props.clearCompletedCart) {
			return;
		}

		clearCart();

		sessionStorage.removeItem('tweakmart-pending-order');
	});

	return null;
}
