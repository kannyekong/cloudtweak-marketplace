import type { APIRoute } from 'astro';

import { ZodError } from 'zod';

import { technicalSupportRequestSchema } from '../../../lib/tweakmart/technical-support-schema';

import { tweakmartSupabase } from '../../../lib/tweakmart/supabase-server';

export const prerender = false;

/* Converts optional text values into database-friendly null values. */
function nullableText(value: string | null | undefined) {
	const normalizedValue = value?.trim();

	return normalizedValue || null;
}

/* Returns a consistent JSON response from the technical-support API. */
function jsonResponse(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

/* Accepts, validates and stores a new TweakMart technical-support request. */
export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();

		const input = technicalSupportRequestSchema.parse(body);

		const { data, error } = await tweakmartSupabase
			.from('technical_support_requests')
			.insert({
				request_number: null,

				first_name: input.first_name,
				last_name: input.last_name,

				email: input.email.toLowerCase(),
				phone: input.phone,

				company_name: nullableText(input.company_name),

				job_title: nullableText(input.job_title),

				support_type: input.support_type,

				product_or_service: nullableText(input.product_or_service),

				issue_summary: input.issue_summary,

				requirements: nullableText(input.requirements),

				preferred_date: nullableText(input.preferred_date),

				location: nullableText(input.location),

				source: input.source,
			})
			.select('id, request_number')
			.single();

		if (error || !data) {
			console.error('Unable to create technical support request:', error);

			return jsonResponse(
				{
					success: false,
					message: 'We could not submit your support request. Please try again.',
				},
				500,
			);
		}

		return jsonResponse(
			{
				success: true,
				request_number: data.request_number,
				message: 'Your technical support request has been received.',
			},
			201,
		);
	} catch (error) {
		if (error instanceof ZodError) {
			return jsonResponse(
				{
					success: false,
					message: error.issues[0]?.message ?? 'Please check your support request.',
				},
				400,
			);
		}

		console.error('Unexpected technical support request error:', error);

		return jsonResponse(
			{
				success: false,
				message: 'Something went wrong while submitting your request.',
			},
			500,
		);
	}
};
