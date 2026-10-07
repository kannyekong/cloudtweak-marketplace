import { queryOptions } from '@tanstack/solid-query';

import { getCartItems, type TweakMartCartItem } from '~/lib/tweakmart/cart.ts';

export interface TweakMartCartQueryData {
	items: TweakMartCartItem[];
}

/* Creates the shared TanStack Query configuration for the browser-based TweakMart cart. */
export function cartQueryOptions() {
	return queryOptions({
		queryKey: ['cart'],

		queryFn: (): TweakMartCartQueryData => ({
			items: getCartItems(),
		}),

		initialData: {
			items: [],
		} satisfies TweakMartCartQueryData,
	});
}
