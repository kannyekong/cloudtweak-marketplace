const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

export interface PaystackTransactionData {
	id: number;
	status: string;
	reference: string;
	amount: number;
	currency: string;
	channel: string;
	paid_at: string | null;
	metadata?: unknown;
}

interface PaystackVerifyResponse {
	status: boolean;
	message: string;
	data?: PaystackTransactionData;
}

/* Checks whether an unknown Paystack response has the expected verification structure. */
function isPaystackVerifyResponse(value: unknown): value is PaystackVerifyResponse {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const response = value as Record<string, unknown>;

	return typeof response.status === 'boolean' && typeof response.message === 'string';
}

/* Verifies a Paystack transaction directly with Paystack's server API. */
export async function verifyPaystackTransaction(reference: string) {
	const paystackSecretKey = import.meta.env.PAYSTACK_SECRET_KEY;

	if (!paystackSecretKey) {
		throw new Error('PAYSTACK_SECRET_KEY is not configured.');
	}

	const response = await fetch(`${PAYSTACK_VERIFY_URL}/${encodeURIComponent(reference)}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${paystackSecretKey}`,
		},
	});

	const responseText = await response.text();

	let result: unknown = null;

	try {
		result = responseText ? JSON.parse(responseText) : null;
	} catch {
		throw new Error('Paystack returned an invalid verification response.');
	}

	if (!response.ok || !isPaystackVerifyResponse(result) || !result.status || !result.data) {
		throw new Error(
			isPaystackVerifyResponse(result) ? result.message : 'Unable to verify Paystack transaction.',
		);
	}

	return {
		response: result,
		transaction: result.data,
	};
}
