import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { verifyPaystackTransaction } from '../../../lib/tweakmart/paystack-server';
import { tweakmartSupabase } from '../../../lib/tweakmart/supabase-server';

interface PaystackWebhookEvent {
	event: string;
	data?: {
		reference?: string;
	};
}

/* Safely checks whether an unknown payload resembles a Paystack webhook event. */
function isPaystackWebhookEvent(value: unknown): value is PaystackWebhookEvent {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const event = value as Record<string, unknown>;

	return typeof event.event === 'string';
}

/* Compares the supplied Paystack signature with our locally generated HMAC signature. */
function isValidPaystackSignature(rawBody: string, suppliedSignature: string, secretKey: string) {
	const expectedSignature = createHmac('sha512', secretKey).update(rawBody).digest('hex');

	const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
	const suppliedBuffer = Buffer.from(suppliedSignature, 'utf8');

	if (expectedBuffer.length !== suppliedBuffer.length) {
		return false;
	}

	return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/* Processes authenticated Paystack webhook events for TweakMart payments. */
export const POST: APIRoute = async ({ request }) => {
	const paystackSecretKey = import.meta.env.PAYSTACK_SECRET_KEY;

	if (!paystackSecretKey) {
		console.error('PAYSTACK_SECRET_KEY is not configured for the webhook.');

		return new Response(null, {
			status: 500,
		});
	}

	const signature = request.headers.get('x-paystack-signature');

	if (!signature) {
		return new Response(null, {
			status: 401,
		});
	}

	/*
	 * Signature verification must use the exact raw request body,
	 * before parsing or modifying the JSON payload.
	 */
	const rawBody = await request.text();

	if (!isValidPaystackSignature(rawBody, signature, paystackSecretKey)) {
		return new Response(null, {
			status: 401,
		});
	}

	let event: unknown;

	try {
		event = JSON.parse(rawBody);
	} catch {
		return new Response(null, {
			status: 400,
		});
	}

	if (!isPaystackWebhookEvent(event)) {
		return new Response(null, {
			status: 400,
		});
	}

	/*
	 * TweakMart currently only needs successful charge events.
	 * Other authenticated Paystack events are acknowledged and ignored.
	 */
	if (event.event !== 'charge.success') {
		return new Response(null, {
			status: 200,
		});
	}

	const reference = event.data?.reference;

	if (!reference) {
		return new Response(null, {
			status: 200,
		});
	}

	try {
		/*
		 * The valid webhook signature establishes event origin.
		 * We additionally verify the transaction directly with Paystack
		 * before changing financial/order state.
		 */
		const { response, transaction } = await verifyPaystackTransaction(reference);

		if (transaction.status !== 'success') {
			console.error(`Paystack webhook transaction ${reference} did not verify as successful.`);

			return new Response(null, {
				status: 200,
			});
		}

		const amount = transaction.amount / 100;

		const { error } = await tweakmartSupabase.rpc('confirm_tweakmart_paystack_payment', {
			p_reference: transaction.reference,
			p_amount: amount,
			p_currency: transaction.currency,
			p_channel: transaction.channel,
			p_paid_at: transaction.paid_at,
			p_provider_response: response,
		});

		if (error) {
			console.error('Unable to process TweakMart Paystack webhook:', error);

			/*
			 * A non-200 response allows Paystack to retry a valid
			 * webhook when our own processing temporarily fails.
			 */
			return new Response(null, {
				status: 500,
			});
		}

		return new Response(null, {
			status: 200,
		});
	} catch (error) {
		console.error('TweakMart Paystack webhook processing error:', error);

		return new Response(null, {
			status: 500,
		});
	}
};
