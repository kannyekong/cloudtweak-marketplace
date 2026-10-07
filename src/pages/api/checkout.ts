import type { APIRoute } from 'astro';
import { z } from 'zod';

import { tweakmartSupabase } from '~/lib/tweakmart/supabase-server';

/* Defines the only cart information the browser is permitted to submit to checkout. */
const checkoutItemSchema = z.object({
	product_id: z.string().uuid(),

	/*
	 * Products without variants may omit variant_id entirely when the
	 * browser serializes the cart. Accept both omitted and explicit
	 * null values, then normalize both cases to null.
	 */
	variant_id: z
		.string()
		.uuid()
		.nullish()
		.transform((value) => value ?? null),

	/*
	 * Coerces numeric strings safely because cart state can sometimes
	 * originate from input/local-storage values serialized as strings.
	 */
	quantity: z.coerce.number().int().min(1).max(99),
});

/* Defines and validates the complete checkout request from the browser. */
const checkoutRequestSchema = z.object({
	items: z.array(checkoutItemSchema).min(1).max(100),
});

type CheckoutRequestItem = z.infer<typeof checkoutItemSchema>;

/* Converts database numeric values into safe JavaScript numbers. */
function toNumber(value: unknown) {
	const number = Number(value);

	return Number.isFinite(number) ? number : 0;
}

/* Creates a stable key for identifying duplicate cart lines. */
function getCartLineKey(productId: string, variantId: string | null) {
	return `${productId}:${variantId ?? 'default'}`;
}

/* Combines duplicate product/variant lines before validating the cart. */
function normalizeCheckoutItems(items: CheckoutRequestItem[]) {
	const normalizedItems = new Map<string, CheckoutRequestItem>();

	for (const item of items) {
		const key = getCartLineKey(item.product_id, item.variant_id);
		const existingItem = normalizedItems.get(key);

		if (existingItem) {
			const quantity = existingItem.quantity + item.quantity;

			if (quantity > 99) {
				throw new Error('MAXIMUM_QUANTITY_EXCEEDED');
			}

			existingItem.quantity = quantity;
			continue;
		}

		normalizedItems.set(key, {
			...item,
		});
	}

	return Array.from(normalizedItems.values());
}

/* Returns a JSON checkout error using a consistent response structure. */
function checkoutError(message: string, status: number, details?: unknown) {
	return Response.json(
		{
			success: false,
			error: message,
			...(details ? { details } : {}),
		},
		{
			status,
		},
	);
}

/* Validates the browser cart against authoritative TweakMart database records. */
export const POST: APIRoute = async ({ request }) => {
	try {
		const body: unknown = await request.json();
		const parsed = checkoutRequestSchema.safeParse(body);

		if (!parsed.success) {
			/*
			 * Logs the precise checkout-contract failure server-side and
			 * returns validation details so development issues are easy
			 * to diagnose instead of being hidden behind a generic error.
			 */
			const details = parsed.error.flatten();

			console.error('TweakMart checkout request validation failed:', details);

			return checkoutError(
				parsed.error.issues[0]?.message ?? 'Your cart contains invalid checkout information.',
				400,
				details,
			);
		}

		let requestedItems: CheckoutRequestItem[];

		try {
			requestedItems = normalizeCheckoutItems(parsed.data.items);
		} catch {
			return checkoutError('A maximum quantity of 99 is allowed for each cart item.', 400);
		}

		const validatedItems = [];

		for (const requestedItem of requestedItems) {
			/* Always reload the product from Supabase instead of trusting browser cart data. */
			const { data: product, error: productError } = await tweakmartSupabase
				.from('products')
				.select(
					`
                            id,
                            name,
                            slug,
                            product_type,
                            status,
                            base_price,
                            currency,
                            published_at
                        `,
				)
				.eq('id', requestedItem.product_id)
				.eq('status', 'active')
				.not('published_at', 'is', null)
				.maybeSingle();

			if (productError) {
				console.error('TweakMart checkout product lookup failed:', productError);

				return checkoutError('We could not validate your cart. Please try again.', 500);
			}

			if (!product) {
				return checkoutError('One of the products in your cart is no longer available.', 409);
			}

			/* Load all active variants so the server can determine whether a variant is required. */
			const { data: activeVariants, error: variantsError } = await tweakmartSupabase
				.from('product_variants')
				.select(
					`
                            id,
                            product_id,
                            name,
                            sku,
                            price,
                            compare_at_price,
                            is_default,
                            is_active
                        `,
				)
				.eq('product_id', product.id)
				.eq('is_active', true);

			if (variantsError) {
				console.error('TweakMart checkout variants lookup failed:', variantsError);

				return checkoutError('We could not validate the selected product options.', 500);
			}

			const variants = activeVariants ?? [];

			/* Products with active variants must explicitly identify the chosen variant. */
			if (variants.length > 0 && !requestedItem.variant_id) {
				return checkoutError(
					`Please select an option for ${product.name} before checking out.`,
					409,
				);
			}

			/* Products without variants must not accept a fabricated variant ID. */
			if (variants.length === 0 && requestedItem.variant_id) {
				return checkoutError(
					`The selected option for ${product.name} is no longer available.`,
					409,
				);
			}

			const selectedVariant = requestedItem.variant_id
				? variants.find((variant) => variant.id === requestedItem.variant_id)
				: null;

			if (requestedItem.variant_id && !selectedVariant) {
				return checkoutError(
					`The selected option for ${product.name} is no longer available.`,
					409,
				);
			}

			/* Variant price overrides the product base price when a variant-specific price exists. */
			const unitPrice =
				selectedVariant?.price !== null && selectedVariant?.price !== undefined
					? toNumber(selectedVariant.price)
					: toNumber(product.base_price);

			if (unitPrice < 0) {
				console.error('TweakMart checkout encountered an invalid product price:', product.id);

				return checkoutError('We could not validate the price of one of your cart items.', 500);
			}

			/*
			 * Inventory is currently attached to product variants.
			 * Variant inventory is therefore validated whenever a variant is selected.
			 */
			if (selectedVariant) {
				const { data: inventory, error: inventoryError } = await tweakmartSupabase
					.from('inventory')
					.select(
						`
                                quantity_available,
                                quantity_reserved,
                                track_inventory,
                                allow_backorder
                            `,
					)
					.eq('variant_id', selectedVariant.id)
					.maybeSingle();

				if (inventoryError) {
					console.error('TweakMart checkout inventory lookup failed:', inventoryError);

					return checkoutError('We could not validate product availability.', 500);
				}

				/*
				 * A missing inventory row does not automatically make the product unavailable.
				 * Inventory restrictions apply only when an inventory record explicitly tracks stock.
				 */
				if (inventory?.track_inventory && !inventory.allow_backorder) {
					const availableStock = Math.max(
						0,
						toNumber(inventory.quantity_available) - toNumber(inventory.quantity_reserved),
					);

					if (requestedItem.quantity > availableStock) {
						if (availableStock === 0) {
							return checkoutError(`${product.name} is currently out of stock.`, 409);
						}

						return checkoutError(
							`Only ${availableStock} unit${
								availableStock === 1 ? '' : 's'
							} of ${product.name} are currently available.`,
							409,
						);
					}
				}
			}

			const lineTotal = unitPrice * requestedItem.quantity;

			validatedItems.push({
				product_id: product.id,
				product_slug: product.slug,
				product_name: product.name,
				product_type: product.product_type,
				variant_id: selectedVariant?.id ?? null,
				variant_name: selectedVariant?.name ?? null,
				sku: selectedVariant?.sku ?? null,
				quantity: requestedItem.quantity,
				unit_price: unitPrice,
				line_total: lineTotal,
				currency: product.currency ?? 'NGN',
			});
		}

		/* Prevent a single checkout from combining products using different currencies. */
		const currencies = new Set(validatedItems.map((item) => item.currency.toUpperCase()));

		if (currencies.size !== 1) {
			return checkoutError(
				'Products using different currencies cannot be checked out together.',
				400,
			);
		}

		/* Calculate the authoritative subtotal exclusively from server-validated prices. */
		const subtotal = validatedItems.reduce((total, item) => total + item.line_total, 0);

		const currency = validatedItems[0]?.currency.toUpperCase() ?? 'NGN';

		return Response.json({
			success: true,

			checkout: {
				items: validatedItems,
				currency,
				subtotal,
			},
		});
	} catch (error) {
		console.error('TweakMart checkout validation failed:', error);

		return checkoutError('We could not prepare your checkout. Please try again.', 500);
	}
};
