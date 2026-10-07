import { tweakmartSupabase } from './supabase-server';

export interface StorefrontProductOffer {
	id: string;
	product_id: string;
	title: string;
	offer_price: number;
	starts_at: string;
	ends_at: string;
}

/* Normalizes a product offer returned by Supabase into the storefront offer shape. */
function normalizeProductOffer(offer: Record<string, any>): StorefrontProductOffer {
	return {
		id: offer.id,
		product_id: offer.product_id,
		title: offer.title,
		offer_price: Number(offer.offer_price),
		starts_at: offer.starts_at,
		ends_at: offer.ends_at,
	};
}

/* Loads the currently active promotional offer for one product. */
export async function getActiveProductOffer(
	productId: string,
): Promise<StorefrontProductOffer | null> {
	const now = new Date().toISOString();

	const { data, error } = await tweakmartSupabase
		.from('product_offers')
		.select(
			`
                        id,
                        product_id,
                        title,
                        offer_price,
                        starts_at,
                        ends_at
                `,
		)
		.eq('product_id', productId)
		.eq('is_active', true)
		.lte('starts_at', now)
		.gt('ends_at', now)
		.order('offer_price', {
			ascending: true,
		})
		.order('ends_at', {
			ascending: true,
		})
		.limit(1)
		.maybeSingle();

	if (error) {
		console.error(`Unable to load active offer for product ${productId}:`, error);

		return null;
	}

	return data ? normalizeProductOffer(data) : null;
}

/* Loads active offers for multiple products in one query to avoid one database request per product. */
export async function getActiveProductOffers(
	productIds: string[],
): Promise<Map<string, StorefrontProductOffer>> {
	if (productIds.length === 0) {
		return new Map();
	}

	const now = new Date().toISOString();

	const { data, error } = await tweakmartSupabase
		.from('product_offers')
		.select(
			`
                        id,
                        product_id,
                        title,
                        offer_price,
                        starts_at,
                        ends_at
                `,
		)
		.in('product_id', productIds)
		.eq('is_active', true)
		.lte('starts_at', now)
		.gt('ends_at', now)
		.order('offer_price', {
			ascending: true,
		})
		.order('ends_at', {
			ascending: true,
		});

	if (error) {
		console.error('Unable to load active TweakMart product offers:', error);

		return new Map();
	}

	const offersByProduct = new Map<string, StorefrontProductOffer>();

	for (const row of data ?? []) {
		/*
		 * The query is ordered by offer price, so the first valid
		 * offer encountered for a product is the preferred offer.
		 */
		if (!offersByProduct.has(row.product_id)) {
			offersByProduct.set(row.product_id, normalizeProductOffer(row));
		}
	}

	return offersByProduct;
}
