import { createSignal, onCleanup, onMount, Show } from 'solid-js';

import { getWishlistCount, subscribeToWishlist } from '../../lib/tweakmart/wishlist';

/* Displays the live number of products saved in the customer's browser. */
export default function WishlistCount() {
	const [count, setCount] = createSignal(0);

	/* Loads the saved count after hydration and listens for future wishlist changes. */
	onMount(() => {
		setCount(getWishlistCount());

		const unsubscribe = subscribeToWishlist((items) => {
			setCount(items.length);
		});

		onCleanup(unsubscribe);
	});

	return (
		<Show when={count() > 0}>
			<span class="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white">
				{count() > 99 ? '99+' : count()}
			</span>
		</Show>
	);
}
