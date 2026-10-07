import { createSignal, onCleanup, onMount } from 'solid-js';
import { FiHeart } from 'solid-icons/fi';

import {
	isProductSaved,
	subscribeToWishlist,
	toggleWishlistItem,
} from '../../lib/tweakmart/wishlist';

interface WishlistButtonProps {
	productId: string;
	slug: string;
	name: string;
	price: number;
	imageUrl?: string | null;
	brandName?: string | null;
	showLabel?: boolean;
	class?: string;
}

/* Provides a reusable wishlist toggle for product cards and product detail pages. */
export default function WishlistButton(props: WishlistButtonProps) {
	const [saved, setSaved] = createSignal(false);

	/* Synchronizes the button with the wishlist after browser hydration. */
	onMount(() => {
		setSaved(isProductSaved(props.productId));

		const unsubscribe = subscribeToWishlist(() => {
			setSaved(isProductSaved(props.productId));
		});

		onCleanup(unsubscribe);
	});

	/* Adds or removes the current product from the customer's saved items. */
	function handleToggle(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		const result = toggleWishlistItem({
			product_id: props.productId,
			slug: props.slug,
			name: props.name,
			price: props.price,
			image_url: props.imageUrl ?? null,
			brand_name: props.brandName ?? null,
		});

		setSaved(result.saved);
	}

	return (
		<button
			type="button"
			onClick={handleToggle}
			aria-label={saved() ? `Remove ${props.name} from saved items` : `Save ${props.name}`}
			aria-pressed={saved()}
			class={`inline-flex items-center justify-center gap-2 transition ${props.class ?? ''}`}
		>
			<FiHeart
				class={`size-5 transition ${saved() ? 'fill-red-500 text-red-500' : 'text-slate-600'}`}
			/>

			{props.showLabel && <span>{saved() ? 'Saved' : 'Save item'}</span>}
		</button>
	);
}
