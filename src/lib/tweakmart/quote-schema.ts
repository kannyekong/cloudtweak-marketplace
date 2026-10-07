import { z } from 'zod';

/* Defines the validation rules for every product or technology included in a quote request. */
export const quoteRequestItemSchema = z.object({
	product_id: z.string().uuid().nullable().optional(),
	variant_id: z.string().uuid().nullable().optional(),
	product_name: z
		.string()
		.trim()
		.min(2, 'Enter the product or technology you need.')
		.max(200, 'Product name is too long.'),
	sku: z.string().trim().max(100).nullable().optional(),
	quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(100000),
	specifications: z.string().trim().max(2000).nullable().optional(),
});

/* Defines the complete server-side validation contract for a TweakMart quote request. */
export const quoteRequestSchema = z.object({
	request_type: z
		.enum(['quote', 'bulk_order', 'business_purchase', 'it_procurement'])
		.default('quote'),

	first_name: z.string().trim().min(2, 'Enter your first name.').max(100),
	last_name: z.string().trim().min(2, 'Enter your last name.').max(100),

	email: z.string().trim().email('Enter a valid email address.').max(255),
	phone: z.string().trim().min(7, 'Enter a valid phone number.').max(30),

	company_name: z.string().trim().max(200).nullable().optional(),
	job_title: z.string().trim().max(150).nullable().optional(),

	budget_range: z.string().trim().max(100).nullable().optional(),

	required_by_date: z
		.string()
		.trim()
		.nullable()
		.optional()
		.refine(
			(value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
			'Enter a valid required-by date.',
		),

	delivery_address: z.string().trim().max(500).nullable().optional(),
	delivery_city: z.string().trim().max(100).nullable().optional(),
	delivery_state: z.string().trim().max(100).nullable().optional(),
	delivery_country: z.string().trim().max(100).default('Nigeria'),

	additional_requirements: z.string().trim().max(5000).nullable().optional(),

	source: z.string().trim().max(100).default('request_quote_page'),

	items: z
		.array(quoteRequestItemSchema)
		.min(1, 'Add at least one product or technology to your request.')
		.max(25, 'A quote request can contain up to 25 items.'),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
