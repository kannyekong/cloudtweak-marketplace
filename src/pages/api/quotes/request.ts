import type { APIRoute } from 'astro';
import { ZodError } from 'zod';
import { quoteRequestSchema } from '../../../lib/tweakmart/quote-schema';
import { tweakmartSupabase } from '../../../lib/tweakmart/supabase-server';

export const prerender = false;

/* Converts optional string values into database-friendly null values. */
function nullableText(value: string | null | undefined) {
	const normalizedValue = value?.trim();

	return normalizedValue ? normalizedValue : null;
}

/* Returns a consistent JSON response from the quote request API. */
function jsonResponse(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

/* Accepts, validates and persists a new TweakMart quote request and its requested items. */
export const POST: APIRoute = async ({ request }) => {
	let createdQuoteId: string | null = null;

	try {
		const body = await request.json();
		const input = quoteRequestSchema.parse(body);

		const { data: quote, error: quoteError } = await tweakmartSupabase
			.from('quote_requests')
			.insert({
				request_type: input.request_type,
				first_name: input.first_name,
				last_name: input.last_name,
				email: input.email.toLowerCase(),
				phone: input.phone,
				company_name: nullableText(input.company_name),
				job_title: nullableText(input.job_title),
				budget_range: nullableText(input.budget_range),
				required_by_date: nullableText(input.required_by_date),
				delivery_address: nullableText(input.delivery_address),
				delivery_city: nullableText(input.delivery_city),
				delivery_state: nullableText(input.delivery_state),
				delivery_country: input.delivery_country,
				additional_requirements: nullableText(input.additional_requirements),
				source: input.source,
			})
			.select('id, quote_number')
			.single();

		if (quoteError || !quote) {
			console.error('Unable to create TweakMart quote request:', quoteError);

			return jsonResponse(
				{
					success: false,
					message: 'We could not create your quote request. Please try again.',
				},
				500,
			);
		}

		createdQuoteId = quote.id;

		const quoteItems = input.items.map((item) => ({
			quote_request_id: quote.id,
			product_id: item.product_id ?? null,
			variant_id: item.variant_id ?? null,
			product_name: item.product_name,
			sku: nullableText(item.sku),
			quantity: item.quantity,
			specifications: nullableText(item.specifications),
		}));

		const { error: itemsError } = await tweakmartSupabase
			.from('quote_request_items')
			.insert(quoteItems);

		if (itemsError) {
			console.error('Unable to create TweakMart quote request items:', itemsError);

			/*
			 * Removes the parent request if its items fail to save so that an incomplete
			 * quote does not appear in management. The foreign key cascades any items
			 * that may have been inserted with the request.
			 */
			await tweakmartSupabase.from('quote_requests').delete().eq('id', quote.id);

			return jsonResponse(
				{
					success: false,
					message: 'We could not save the products in your request. Please try again.',
				},
				500,
			);
		}

		return jsonResponse(
			{
				success: true,
				quote_number: quote.quote_number,
				message: 'Your quote request has been received.',
			},
			201,
		);
	} catch (error) {
		/*
		 * Returns the first useful validation message without exposing the full Zod
		 * structure or any server implementation details to the storefront.
		 */
		if (error instanceof ZodError) {
			return jsonResponse(
				{
					success: false,
					message: error.issues[0]?.message ?? 'Please check your quote request.',
				},
				400,
			);
		}

		console.error('Unexpected TweakMart quote request error:', error);

		/*
		 * Removes a quote if an unexpected failure occurred after the parent record was
		 * created but before the complete request could be persisted.
		 */
		if (createdQuoteId) {
			await tweakmartSupabase.from('quote_requests').delete().eq('id', createdQuoteId);
		}

		return jsonResponse(
			{
				success: false,
				message: 'Something went wrong while submitting your request. Please try again.',
			},
			500,
		);
	}
};
