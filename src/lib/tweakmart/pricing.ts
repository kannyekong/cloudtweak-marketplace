import type { StorefrontProduct } from './storefront-products';

/* Resolves the current selling price for a product, preferring an active promotional offer. */
export function getProductEffectivePrice(product: StorefrontProduct): number {
	return product.active_offer?.offer_price ?? product.base_price;
}

/* Calculates the percentage discount for a product with an active promotional offer. */
export function getProductOfferPercentage(product: StorefrontProduct): number | null {
	const offerPrice = product.active_offer?.offer_price;

	if (offerPrice === undefined || offerPrice >= product.base_price || product.base_price <= 0) {
		return null;
	}

	return Math.round(((product.base_price - offerPrice) / product.base_price) * 100);
}
