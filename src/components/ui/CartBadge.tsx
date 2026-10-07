import { createSignal, onCleanup, onMount } from 'solid-js';

import {
	getCartItemCount,
	getCartItems,
	TWEAKMART_CART_UPDATED_EVENT,
} from '../../lib/tweakmart/cart';

/* Displays the total quantity of products currently stored in the browser cart. */
export default function CartBadge() {
	const [count, setCount] = createSignal(0);

	/* Synchronizes the badge count with the current local cart state. */
	function synchronizeCart() {
		setCount(getCartItemCount(getCartItems()));
	}

	/* Initializes the cart badge and listens for cart changes after the component mounts in the browser. */
	onMount(() => {
		synchronizeCart();

		window.addEventListener(TWEAKMART_CART_UPDATED_EVENT, synchronizeCart);

		window.addEventListener('storage', synchronizeCart);

		/* Removes browser event listeners when the client-side component is destroyed. */
		onCleanup(() => {
			window.removeEventListener(TWEAKMART_CART_UPDATED_EVENT, synchronizeCart);

			window.removeEventListener('storage', synchronizeCart);
		});
	});

	return (
		<>
			{count() > 0 && (
				<span class="bg-primary absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-red-500 shadow-sm">
					{count() > 99 ? '99+' : count()}
				</span>
			)}
		</>
	);
}
