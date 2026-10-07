import { tweakmartSupabase } from './supabase-server';

export interface StorefrontOrderItem {
	id: string;
	product_name: string;
	variant_name: string | null;
	sku: string | null;
	quantity: number;
	unit_price: number;
	line_total: number;
}

export interface StorefrontOrderDetails {
	id: string;
	order_number: string;

	customer_first_name: string;
	customer_last_name: string;
	customer_email: string;
	customer_phone: string;

	delivery_address: string;
	delivery_city: string;
	delivery_state: string;
	delivery_notes: string | null;

	subtotal: number;
	delivery_fee: number;
	total: number;
	currency: string;

	payment_method: string;
	payment_status: string;
	payment_channel: string | null;

	order_status: string;

	paid_at: string | null;
	confirmed_at: string | null;
	created_at: string;

	items: StorefrontOrderItem[];
}

/* Safely converts Supabase numeric values into JavaScript numbers. */
function toNumber(value: number | string | null | undefined) {
	const numericValue = Number(value ?? 0);

	return Number.isFinite(numericValue) ? numericValue : 0;
}

/* Loads a private customer order using both its public number and secret access token. */
export async function getStorefrontOrder(
	orderNumber: string,
	accessToken: string,
): Promise<StorefrontOrderDetails | null> {
	const { data: order, error } = await tweakmartSupabase
		.from('orders')
		.select(
			`
				id,
				order_number,
				customer_first_name,
				customer_last_name,
				customer_email,
				customer_phone,
				delivery_address,
				delivery_city,
				delivery_state,
				delivery_notes,
				subtotal,
				delivery_fee,
				total,
				currency,
				payment_method,
				payment_status,
				payment_channel,
				order_status,
				paid_at,
				confirmed_at,
				created_at,
				order_items (
					id,
					product_name,
					variant_name,
					sku,
					quantity,
					unit_price,
					line_total
				)
			`,
		)
		.eq('order_number', orderNumber)
		.eq('access_token', accessToken)
		.maybeSingle();

	if (error) {
		console.error('Unable to load TweakMart order:', error);

		return null;
	}

	if (!order) {
		return null;
	}

	return {
		id: order.id,
		order_number: order.order_number,

		customer_first_name: order.customer_first_name,
		customer_last_name: order.customer_last_name,
		customer_email: order.customer_email,
		customer_phone: order.customer_phone,

		delivery_address: order.delivery_address,
		delivery_city: order.delivery_city,
		delivery_state: order.delivery_state,
		delivery_notes: order.delivery_notes,

		subtotal: toNumber(order.subtotal),

		delivery_fee: toNumber(order.delivery_fee),

		total: toNumber(order.total),

		currency: order.currency,

		payment_method: order.payment_method,
		payment_status: order.payment_status,
		payment_channel: order.payment_channel,

		order_status: order.order_status,

		paid_at: order.paid_at,
		confirmed_at: order.confirmed_at,
		created_at: order.created_at,

		items: (order.order_items ?? []).map((item) => ({
			id: item.id,

			product_name: item.product_name,

			variant_name: item.variant_name,

			sku: item.sku,

			quantity: item.quantity,

			unit_price: toNumber(item.unit_price),

			line_total: toNumber(item.line_total),
		})),
	};
}
