import type { APIRoute } from 'astro';
import { z } from 'zod';

import { tweakmartSupabase } from '../../../../lib/tweakmart/supabase-server';

const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';

const initializePaymentSchema = z.object({
	order_id: z.string().uuid(),
});

interface PaystackInitializeResponse {
	status: boolean;
	message: string;
	data?: {
		authorization_url: string;
		access_code: string;
		reference: string;
	};
}

/* Safely converts database numeric values into JavaScript numbers. */
function toNumber(value: number | string | null | undefined) {
	const numericValue = Number(value ?? 0);

	return Number.isFinite(numericValue) ? numericValue : 0;
}

/* Generates a unique Paystack reference for a TweakMart order. */
function generatePaymentReference(orderNumber: string) {
	const randomPart = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();

	return `TM-PAY-${orderNumber.replaceAll('-', '')}-${randomPart}`;
}

/* Initializes a trusted pending TweakMart order with Paystack. */
export const POST: APIRoute = async ({ request, url }) => {
	try {
		const paystackSecretKey = import.meta.env.PAYSTACK_SECRET_KEY;

		if (!paystackSecretKey) {
			console.error('PAYSTACK_SECRET_KEY is not configured.');

			return Response.json(
				{
					success: false,
					error: 'Online payment is temporarily unavailable.',
				},
				{
					status: 500,
				},
			);
		}

		const body: unknown = await request.json();

		const parsed = initializePaymentSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{
					success: false,
					error: 'Invalid payment request.',
				},
				{
					status: 400,
				},
			);
		}

		const { order_id } = parsed.data;

		/*
		 * Reloads the order from Supabase rather than trusting
		 * payment amount, email or order details from the browser.
		 */
		const { data: order, error: orderError } = await tweakmartSupabase
			.from('orders')
			.select(
				`
					id,
					order_number,
					customer_first_name,
					customer_last_name,
					customer_email,
					customer_phone,
					total,
					currency,
					payment_method,
					payment_status,
					order_status
				`,
			)
			.eq('id', order_id)
			.single();

		if (orderError || !order) {
			return Response.json(
				{
					success: false,
					error: 'Order could not be found.',
				},
				{
					status: 404,
				},
			);
		}

		if (order.payment_method !== 'paystack') {
			return Response.json(
				{
					success: false,
					error: 'This order does not require online payment.',
				},
				{
					status: 400,
				},
			);
		}

		if (order.payment_status === 'paid') {
			return Response.json(
				{
					success: false,
					error: 'This order has already been paid.',
				},
				{
					status: 409,
				},
			);
		}

		if (order.order_status === 'cancelled') {
			return Response.json(
				{
					success: false,
					error: 'This order has been cancelled.',
				},
				{
					status: 409,
				},
			);
		}

		const amount = toNumber(order.total);

		if (amount <= 0) {
			return Response.json(
				{
					success: false,
					error: 'The order total is invalid.',
				},
				{
					status: 400,
				},
			);
		}

		const reference = generatePaymentReference(order.order_number);

		/*
		 * Paystack expects NGN amounts in kobo, so the trusted
		 * server-side order total is converted before initialization.
		 */
		const amountInKobo = Math.round(amount * 100);

		const callbackUrl = new URL('/api/checkout/paystack/callback', url.origin);

		const paystackResponse = await fetch(PAYSTACK_INITIALIZE_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${paystackSecretKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email: order.customer_email,
				amount: amountInKobo,
				currency: order.currency || 'NGN',
				reference,
				callback_url: callbackUrl.toString(),

				metadata: {
					order_id: order.id,
					order_number: order.order_number,
					customer_name: `${order.customer_first_name} ${order.customer_last_name}`.trim(),
					customer_phone: order.customer_phone,
				},
			}),
		});

		const paystackResponseText = await paystackResponse.text();

		let paystackResult: PaystackInitializeResponse | null = null;

		try {
			const parsedResponse: unknown = paystackResponseText
				? JSON.parse(paystackResponseText)
				: null;

			if (typeof parsedResponse === 'object' && parsedResponse !== null) {
				paystackResult = parsedResponse as PaystackInitializeResponse;
			}
		} catch {
			paystackResult = null;
		}

		if (
			!paystackResponse.ok ||
			!paystackResult?.status ||
			!paystackResult.data?.authorization_url
		) {
			console.error('Paystack initialization failed:', paystackResult);

			return Response.json(
				{
					success: false,
					error: 'Unable to initialize payment. Please try again.',
				},
				{
					status: 502,
				},
			);
		}

		/*
		 * Records the payment attempt before sending the customer
		 * to the Paystack-hosted checkout page.
		 */
		const { error: paymentAttemptError } = await tweakmartSupabase.from('payment_attempts').insert({
			order_id: order.id,
			provider: 'paystack',
			reference: paystackResult.data.reference,
			amount,
			currency: order.currency || 'NGN',
			status: 'initialized',
			authorization_url: paystackResult.data.authorization_url,
			provider_response: paystackResult,
		});

		if (paymentAttemptError) {
			console.error('Unable to save Paystack payment attempt:', paymentAttemptError);

			return Response.json(
				{
					success: false,
					error: 'Unable to prepare your payment. Please try again.',
				},
				{
					status: 500,
				},
			);
		}

		return Response.json({
			success: true,

			payment: {
				order_id: order.id,
				order_number: order.order_number,
				reference: paystackResult.data.reference,
				authorization_url: paystackResult.data.authorization_url,
			},
		});
	} catch (error) {
		console.error('TweakMart Paystack initialization error:', error);

		return Response.json(
			{
				success: false,
				error: 'Unable to initialize payment. Please try again.',
			},
			{
				status: 500,
			},
		);
	}
};
