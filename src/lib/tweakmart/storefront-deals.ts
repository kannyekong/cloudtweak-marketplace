import {
	getStorefrontProducts,
	type StorefrontProduct,
	type StorefrontProductSort,
} from './storefront-products';

import { getActiveProductOffers, type StorefrontProductOffer } from './storefront-offers';

import { tweakmartSupabase } from './supabase-server';

export interface GetStorefrontDealsOptions {
	productType?: string;
	sort?: StorefrontProductSort;
	limit?: number;
}

/* Loads the IDs of products that currently have a valid promotional offer. */
async function getActiveDealProductIds(): Promise<string[]> {
	const now = new Date().toISOString();

	const { data, error } = await tweakmartSupabase
		.from('product_offers')
		.select('product_id')
		.eq('is_active', true)
		.lte('starts_at', now)
		.gt('ends_at', now);

	if (error) {
		throw new Error(`Unable to load active TweakMart deals: ${error.message}`);
	}

	return [...new Set((data ?? []).map((offer) => offer.product_id))];
}

/* Attaches the resolved active offer to each deal product. */
function attachActiveOffers(
	products: StorefrontProduct[],
	activeOffers: Map<string, StorefrontProductOffer>,
): StorefrontProduct[] {
	return products
		.map((product) => ({
			...product,
			active_offer: activeOffers.get(product.id) ?? null,
		}))
		.filter((product) => product.active_offer !== null);
}

/* Loads active deal products using the same storefront product pipeline as the rest of TweakMart. */
export async function getStorefrontDeals({
	productType,
	sort = 'recommended',
	limit = 100,
}: GetStorefrontDealsOptions = {}): Promise<StorefrontProduct[]> {
	const productIds = await getActiveDealProductIds();

	if (productIds.length === 0) {
		return [];
	}

	/*
	 * Loads the products and offer map in parallel. The product query still
	 * applies normal storefront publication, status, image and inventory rules.
	 */
	const [products, activeOffers] = await Promise.all([
		getStorefrontProducts({
			productIds,
			productType,
			sort,
			limit,
		}),

		getActiveProductOffers(productIds),
	]);

	return attachActiveOffers(products, activeOffers);
}
