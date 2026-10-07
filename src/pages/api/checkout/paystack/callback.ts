import type { APIRoute } from 'astro';

import { verifyPaystackTransaction } from '../../../../lib/tweakmart/paystack-server';
import { tweakmartSupabase } from '../../../../lib/tweakmart/supabase-server';

/* Redirects the customer after Paystack while independently verifying the transaction server-side. */
export const GET: APIRoute = async ({ url, redirect }) => {
	const reference = url.searchParams.get('reference');

	if (!reference) {
		return redirect('/checkout?payment=invalid');
	}

	try {
		const { response, transaction } = await verifyPaystackTransaction(reference);

		/*
		 * A callback visit alone never proves payment.
		 * The transaction must independently verify as successful.
		 */
		if (transaction.status !== 'success') {
			return redirect(
				`/payment/verification-failed` +
					`?reference=${encodeURIComponent(reference)}` +
					`&status=${encodeURIComponent(transaction.status || 'pending')}`,
			);
		}

		const amount = transaction.amount / 100;

		const { data, error } = await tweakmartSupabase.rpc('confirm_tweakmart_paystack_payment', {
			p_reference: transaction.reference,
			p_amount: amount,
			p_currency: transaction.currency,
			p_channel: transaction.channel,
			p_paid_at: transaction.paid_at,
			p_provider_response: response,
		});

		if (error || !data || data.length === 0) {
			console.error('Unable to confirm callback payment:', error);

			return redirect(`/payment/verification-failed?reference=${encodeURIComponent(reference)}`);
		}

		const order = data[0];

		return redirect(
			`/orders/${encodeURIComponent(order.order_number)}` +
				`?token=${encodeURIComponent(order.access_token)}` +
				'&payment=success',
		);
	} catch (error) {
		console.error('TweakMart Paystack callback error:', error);

		return redirect(`/payment/verification-failed?reference=${encodeURIComponent(reference)}`);
	}
};
