import { createQuery } from '@tanstack/solid-query';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';

import { Button } from '~/components/ui/Button.tsx';
import { Drawer } from '~/components/ui/Drawer.tsx';
import { CartSummary } from '~/features/cart/CartSummary.tsx';
import { cartQueryOptions } from '~/features/cart/cart.queries.ts';
import { getCartItems, TWEAKMART_CART_UPDATED_EVENT } from '~/lib/tweakmart/cart.ts';
import { queryClient } from '~/lib/query.ts';

import { CartButton } from './CartButton.tsx';
import { CartStore } from './store.ts';

interface CheckoutErrorResponse {
	success: false;
	error: string;
}

interface CheckoutSuccessResponse {
	success: true;
	checkout: {
		items: Array<{
			product_id: string;
			product_slug: string;
			product_name: string;
			product_type: string;
			variant_id: string | null;
			variant_name: string | null;
			sku: string | null;
			quantity: number;
			unit_price: number;
			line_total: number;
			currency: string;
		}>;
		currency: string;
		subtotal: number;
	};
}

type CheckoutResponse = CheckoutErrorResponse | CheckoutSuccessResponse;

/* Synchronizes the local TweakMart cart with the shared TanStack Query cache. */
function synchronizeCart() {
	queryClient.setQueryData(['cart'], {
		items: getCartItems(),
	});
}

/* Provides the TweakMart cart drawer and validates the cart before continuing to checkout. */
export function CartDrawer() {
	const query = createQuery(
		() => cartQueryOptions(),
		() => queryClient,
	);

	const [checkoutLoading, setCheckoutLoading] = createSignal(false);

	const [checkoutError, setCheckoutError] = createSignal<string | null>(null);

	/* Keeps the reactive cart synchronized with localStorage changes. */
	onMount(() => {
		synchronizeCart();

		window.addEventListener(TWEAKMART_CART_UPDATED_EVENT, synchronizeCart);

		window.addEventListener('storage', synchronizeCart);

		onCleanup(() => {
			window.removeEventListener(TWEAKMART_CART_UPDATED_EVENT, synchronizeCart);

			window.removeEventListener('storage', synchronizeCart);
		});
	});

	/* Sends only cart identifiers and quantities to the trusted checkout API. */
	async function handleCheckout() {
		if (checkoutLoading() || query.data.items.length === 0) {
			return;
		}

		setCheckoutLoading(true);
		setCheckoutError(null);

		try {
			const items = query.data.items.map((item) => ({
				product_id: item.product_id,
				variant_id: item.variant_id,
				quantity: item.quantity,
			}));

			const response = await fetch('/api/checkout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					items,
				}),
			});

			const responseText = await response.text();

			let result: CheckoutResponse | null = null;

			if (responseText) {
				try {
					result = JSON.parse(responseText) as CheckoutResponse;
				} catch {
					result = null;
				}
			}

			if (!response.ok || !result || !result.success) {
				const message =
					result && !result.success
						? result.error
						: 'We could not validate your cart. Please try again.';

				setCheckoutError(message);

				return;
			}

			/*
			 * Checkout validation has succeeded.
			 * The customer/delivery checkout page will replace this temporary
			 * success state in the next checkout implementation step.
			 */
			/* Continues to the checkout page only after the server validates the current cart. */
			setCheckoutError(null);

			window.location.href = '/checkout';
		} catch (error) {
			console.error('TweakMart checkout request failed:', error);

			setCheckoutError('We could not connect to checkout. Please try again.');
		} finally {
			setCheckoutLoading(false);
		}
	}

	return (
		<Drawer
			title="Cart"
			open={CartStore.drawerOpen}
			onOpenChange={CartStore.setDrawerOpen}
			trigger={<CartButton as="div" />}
		>
			<div class="flex h-full flex-col py-4">
				<CartSummary />

				<Show when={checkoutError()}>
					<div
						role="alert"
						class="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
					>
						{checkoutError()}
					</div>
				</Show>

				<Show when={query.data.items.length > 0}>
					<Button type="button" onClick={handleCheckout} disabled={checkoutLoading()}>
						{checkoutLoading() ? 'Validating cart...' : 'Checkout'}
					</Button>
				</Show>

				<aside class="mt-3 text-balance text-center text-sm font-medium text-theme-base-500">
					Delivery fees and order totals will be confirmed during checkout.
				</aside>
			</div>
		</Drawer>
	);
}
