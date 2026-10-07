import type { StorefrontProductDetails, StorefrontProductVariant } from './storefront-products';

export interface TweakMartCartItem {
	product_id: string;
	product_slug: string;
	product_name: string;
	variant_id: string | null;
	variant_name: string | null;
	sku: string | null;
	quantity: number;
	unit_price: number;
	currency: string;
	image_url: string | null;
}

export const TWEAKMART_CART_UPDATED_EVENT = 'tweakmart:cart-updated';

const CART_STORAGE_KEY = 'tweakmart-cart';

/* Validates that an unknown stored value has the minimum structure required for a TweakMart cart item. */
function isTweakMartCartItem(value: unknown): value is TweakMartCartItem {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const item = value as Record<string, unknown>;

	return (
		typeof item.product_id === 'string' &&
		typeof item.product_slug === 'string' &&
		typeof item.product_name === 'string' &&
		(typeof item.variant_id === 'string' || item.variant_id === null) &&
		(typeof item.variant_name === 'string' || item.variant_name === null) &&
		(typeof item.sku === 'string' || item.sku === null) &&
		typeof item.quantity === 'number' &&
		Number.isFinite(item.quantity) &&
		item.quantity > 0 &&
		typeof item.unit_price === 'number' &&
		Number.isFinite(item.unit_price) &&
		typeof item.currency === 'string' &&
		(typeof item.image_url === 'string' || item.image_url === null)
	);
}

/* Loads and validates the current TweakMart cart safely from browser storage. */
export function getCartItems(): TweakMartCartItem[] {
	if (typeof window === 'undefined') {
		return [];
	}

	const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);

	if (!storedCart) {
		return [];
	}

	try {
		const parsedCart: unknown = JSON.parse(storedCart);

		if (!Array.isArray(parsedCart)) {
			return [];
		}

		return parsedCart.filter(isTweakMartCartItem);
	} catch {
		return [];
	}
}

/* Calculates the total number of units currently stored in the cart. */
export function getCartItemCount(items = getCartItems()) {
	return items.reduce((total, item) => total + item.quantity, 0);
}

/* Persists the cart and tells mounted storefront components that it changed. */
export function saveCartItems(items: TweakMartCartItem[]) {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));

	window.dispatchEvent(
		new CustomEvent(TWEAKMART_CART_UPDATED_EVENT, {
			detail: {
				items,
				count: getCartItemCount(items),
			},
		}),
	);
}

/* Adds a selected product configuration to the cart or increases an existing line. */
export function addToCart({
	product,
	variant,
	quantity,
}: {
	product: StorefrontProductDetails;
	variant: StorefrontProductVariant | null;
	quantity: number;
}) {
	const items = getCartItems();

	const safeQuantity = Math.max(1, quantity);

	const unitPrice = variant?.price ?? product.base_price;

	const variantId = variant?.id ?? null;

	const existingItemIndex = items.findIndex(
		(item) => item.product_id === product.id && item.variant_id === variantId,
	);

	if (existingItemIndex >= 0) {
		const existingItem = items[existingItemIndex];

		if (existingItem) {
			items[existingItemIndex] = {
				...existingItem,
				quantity: existingItem.quantity + safeQuantity,
				unit_price: unitPrice,
			};
		}
	} else {
		items.push({
			product_id: product.id,
			product_slug: product.slug,
			product_name: product.name,
			variant_id: variantId,
			variant_name: variant?.name ?? null,
			sku: variant?.sku ?? null,
			quantity: safeQuantity,
			unit_price: unitPrice,
			currency: product.currency,
			image_url: product.primary_image?.image_url ?? product.images[0]?.image_url ?? null,
		});
	}

	saveCartItems(items);

	return items;
}

/* Updates the quantity of one existing cart line. */
export function updateCartItemQuantity(
	productId: string,
	variantId: string | null,
	quantity: number,
) {
	const safeQuantity = Math.max(1, quantity);

	const items = getCartItems().map((item) => {
		if (item.product_id === productId && item.variant_id === variantId) {
			return {
				...item,
				quantity: safeQuantity,
			};
		}

		return item;
	});

	saveCartItems(items);

	return items;
}

/* Removes one product and variant combination from the cart. */
export function removeCartItem(productId: string, variantId: string | null) {
	const items = getCartItems().filter(
		(item) => !(item.product_id === productId && item.variant_id === variantId),
	);

	saveCartItems(items);

	return items;
}

/* Removes all products from the current browser cart. */
export function clearCart() {
	saveCartItems([]);
}
