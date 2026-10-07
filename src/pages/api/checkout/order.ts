import type { APIRoute } from 'astro';
import { z } from 'zod';

import { tweakmartSupabase } from '../../../lib/tweakmart/supabase-server';

/* Defines the trusted shape of cart lines received from the browser. */
const checkoutItemSchema = z.object({
	product_id: z.string().uuid('The product reference is invalid.'),

	variant_id: z
		.string()
		.uuid('The selected product option is invalid.')
		.nullish()
		.transform((value) => value ?? null),

	quantity: z.coerce
		.number()
		.int('Quantity must be a whole number.')
		.min(1, 'Quantity must be at least 1.')
		.max(99, 'A maximum quantity of 99 is allowed for each cart item.'),
});

/* Defines the complete order request accepted by the checkout API. */
const checkoutOrderSchema = z.object({
	customer: z.object({
		first_name: z
			.string()
			.trim()
			.min(2, 'Enter your first name.')
			.max(100, 'First name is too long.'),

		last_name: z.string().trim().min(2, 'Enter your last name.').max(100, 'Last name is too long.'),

		email: z
			.string()
			.trim()
			.email('Enter a valid email address.')
			.max(255, 'Email address is too long.'),

		phone: z
			.string()
			.trim()
			.min(7, 'Enter a valid phone number.')
			.max(30, 'Phone number is too long.'),
	}),

	delivery: z.object({
		address: z
			.string()
			.trim()
			.min(5, 'Enter a street address with at least 5 characters.')
			.max(500, 'Street address is too long.'),

		city: z.string().trim().min(2, 'Enter your delivery city.').max(120, 'City name is too long.'),

		state: z
			.string()
			.trim()
			.min(2, 'Select your delivery state.')
			.max(120, 'State name is too long.'),

		notes: z.string().trim().max(1000, 'Delivery notes are too long.').optional().default(''),
	}),

	payment_method: z.enum(['paystack', 'pay_on_delivery'], {
		message: 'Choose a valid payment method.',
	}),

	items: z.array(checkoutItemSchema).min(1, 'Your cart is empty.').max(100),
});

type CheckoutItem = z.infer<typeof checkoutItemSchema>;

interface ValidatedOrderItem {
	product_id: string;
	variant_id: string | null;
	product_name: string;
	variant_name: string | null;
	sku: string | null;
	quantity: number;
	unit_price: number;
	line_total: number;
	currency: string;
}

/* Safely converts database numeric values into JavaScript numbers. */
function toNumber(value: number | string | null | undefined) {
	const numericValue = Number(value ?? 0);

	return Number.isFinite(numericValue) ? numericValue : 0;
}

/* Converts nested Zod issue paths into form field names used by the checkout UI. */
function getCheckoutFieldErrors(error: z.ZodError) {
	const fieldErrors: Record<string, string> = {};

	for (const issue of error.issues) {
		const fieldPath = issue.path.join('.');

		if (!fieldPath || fieldErrors[fieldPath]) {
			continue;
		}

		fieldErrors[fieldPath] = issue.message;
	}

	return fieldErrors;
}

/* Normalizes duplicate cart rows before product validation begins. */
function normalizeCheckoutItems(items: CheckoutItem[]) {
	const normalizedItems = new Map<string, CheckoutItem>();

	for (const item of items) {
		const key = `${item.product_id}:${item.variant_id ?? 'default'}`;
		const existing = normalizedItems.get(key);

		if (existing) {
			normalizedItems.set(key, {
				...existing,
				quantity: Math.min(existing.quantity + item.quantity, 99),
			});

			continue;
		}

		normalizedItems.set(key, item);
	}

	return Array.from(normalizedItems.values());
}

/* Checks whether the supplied delivery state qualifies for Pay on Delivery. */
function isPayOnDeliveryEligible(state: string) {
	return state.trim().toLowerCase() === 'lagos';
}

/* Validates one cart line against current product, variant and inventory data. */
async function validateOrderItem(item: CheckoutItem): Promise<ValidatedOrderItem> {
	const { data: product, error: productError } = await tweakmartSupabase
		.from('products')
		.select(
			`
				id,
				name,
				base_price,
				currency,
				status,
				published_at
			`,
		)
		.eq('id', item.product_id)
		.eq('status', 'active')
		.not('published_at', 'is', null)
		.single();

	if (productError || !product) {
		throw new Error('One of the products in your cart is no longer available.');
	}

	const { data: variants, error: variantsError } = await tweakmartSupabase
		.from('product_variants')
		.select(
			`
				id,
				name,
				sku,
				price,
				is_active
			`,
		)
		.eq('product_id', product.id)
		.eq('is_active', true);

	if (variantsError) {
		throw new Error('Unable to validate one of the product variants.');
	}

	const activeVariants = variants ?? [];
	let selectedVariant: (typeof activeVariants)[number] | null = null;

	/* Products with active variants must reference one of those exact variants during checkout. */
	if (activeVariants.length > 0) {
		if (!item.variant_id) {
			throw new Error(`Please select a valid option for ${product.name}.`);
		}

		selectedVariant = activeVariants.find((variant) => variant.id === item.variant_id) ?? null;

		if (!selectedVariant) {
			throw new Error(`The selected option for ${product.name} is no longer available.`);
		}
	} else if (item.variant_id) {
		throw new Error(`The selected option for ${product.name} is invalid.`);
	}

	const unitPrice =
		selectedVariant?.price !== null && selectedVariant?.price !== undefined
			? toNumber(selectedVariant.price)
			: toNumber(product.base_price);

	if (unitPrice < 0) {
		throw new Error(`The price for ${product.name} is currently invalid.`);
	}

	/* Inventory is currently tracked at variant level in the TweakMart inventory schema. */
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
			throw new Error(`Unable to validate inventory for ${product.name}.`);
		}

		if (inventory?.track_inventory) {
			const availableStock = Math.max(
				0,
				toNumber(inventory.quantity_available) - toNumber(inventory.quantity_reserved),
			);

			if (!inventory.allow_backorder && item.quantity > availableStock) {
				throw new Error(
					`Only ${availableStock} unit${availableStock === 1 ? '' : 's'} of ${product.name} are currently available.`,
				);
			}
		}
	}

	return {
		product_id: product.id,
		variant_id: selectedVariant?.id ?? null,
		product_name: product.name,
		variant_name: selectedVariant?.name ?? null,
		sku: selectedVariant?.sku ?? null,
		quantity: item.quantity,
		unit_price: unitPrice,
		line_total: unitPrice * item.quantity,
		currency: product.currency || 'NGN',
	};
}

/* Creates a trusted TweakMart order from the current server-side product data. */
export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		const parsed = checkoutOrderSchema.safeParse(body);

		if (!parsed.success) {
			const fieldErrors = getCheckoutFieldErrors(parsed.error);

			console.error('TweakMart checkout payload validation failed:', {
				fieldErrors,
			});

			return Response.json(
				{
					success: false,
					error: 'Please correct the highlighted checkout fields.',
					field_errors: fieldErrors,
				},
				{
					status: 400,
				},
			);
		}

		const { customer, delivery, payment_method } = parsed.data;
		const items = normalizeCheckoutItems(parsed.data.items);

		/* Pay on Delivery is intentionally restricted to Lagos deliveries at application level. */
		if (payment_method === 'pay_on_delivery' && !isPayOnDeliveryEligible(delivery.state)) {
			return Response.json(
				{
					success: false,
					error: 'Pay on Delivery is available only for deliveries within Lagos.',
					field_errors: {
						'delivery.state': 'Select Lagos as your delivery state to use Pay on Delivery.',
					},
				},
				{
					status: 400,
				},
			);
		}

		const validatedItems: ValidatedOrderItem[] = [];

		/* Every cart item is reloaded from Supabase. Prices sent by the browser are never used. */
		for (const item of items) {
			validatedItems.push(await validateOrderItem(item));
		}

		const currencies = new Set(validatedItems.map((item) => item.currency.toUpperCase()));

		if (currencies.size !== 1) {
			return Response.json(
				{
					success: false,
					error: 'Your cart contains products using different currencies.',
				},
				{
					status: 400,
				},
			);
		}

		const currency = Array.from(currencies)[0] ?? 'NGN';

		/* Calculates all trusted order totals on the server. */
		const subtotal = validatedItems.reduce((total, item) => total + item.line_total, 0);

		/*
		 * Delivery pricing will become its own server-side rule.
		 * It remains zero until that module is implemented.
		 */
		const deliveryFee = 0;
		const total = subtotal + deliveryFee;

		const paymentStatus = payment_method === 'pay_on_delivery' ? 'unpaid' : 'pending';

		/*
		 * All orders begin in pending state.
		 * Pay on Delivery must be explicitly confirmed by an administrator.
		 */
		const orderStatus = 'pending';

		/* The RPC creates the order and all item snapshots inside one database transaction. */
		const { data: orderRows, error: orderError } = await tweakmartSupabase.rpc(
			'create_tweakmart_order',
			{
				p_customer_first_name: customer.first_name,
				p_customer_last_name: customer.last_name,
				p_customer_email: customer.email,
				p_customer_phone: customer.phone,
				p_delivery_address: delivery.address,
				p_delivery_city: delivery.city,
				p_delivery_state: delivery.state,
				p_delivery_notes: delivery.notes,
				p_subtotal: subtotal,
				p_delivery_fee: deliveryFee,
				p_total: total,
				p_currency: currency,
				p_payment_method: payment_method,
				p_payment_status: paymentStatus,
				p_order_status: orderStatus,
				p_items: validatedItems.map((item) => ({
					product_id: item.product_id,
					variant_id: item.variant_id,
					product_name: item.product_name,
					variant_name: item.variant_name,
					sku: item.sku,
					quantity: item.quantity,
					unit_price: item.unit_price,
					line_total: item.line_total,
				})),
			},
		);

		if (orderError || !orderRows || orderRows.length === 0) {
			console.error('TweakMart order creation failed:', orderError);

			return Response.json(
				{
					success: false,
					error: 'Unable to place your order. Please try again.',
				},
				{
					status: 500,
				},
			);
		}

		const order = orderRows[0];

		return Response.json(
			{
				success: true,

				order: {
					id: order.id,
					order_number: order.order_number,
					access_token: order.access_token,
					payment_method: order.payment_method,
					payment_status: order.payment_status,
					order_status: order.order_status,
					total: toNumber(order.total),
					currency: order.currency,
				},

				next_action:
					payment_method === 'pay_on_delivery'
						? 'order_pending_confirmation'
						: 'initialize_paystack',
			},
			{
				status: 201,
			},
		);
	} catch (error) {
		console.error('TweakMart checkout order API error:', error);

		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unable to process your checkout.',
			},
			{
				status: 500,
			},
		);
	}
};
