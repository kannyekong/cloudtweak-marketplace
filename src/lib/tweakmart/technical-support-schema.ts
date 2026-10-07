import { z } from 'zod';

export const technicalSupportRequestSchema = z.object({
	first_name: z.string().trim().min(2, 'Enter your first name.').max(100),

	last_name: z.string().trim().min(2, 'Enter your last name.').max(100),

	email: z.string().trim().email('Enter a valid email address.').max(255),

	phone: z.string().trim().min(7, 'Enter a valid phone number.').max(30),

	company_name: z.string().trim().max(200).nullable().optional(),

	job_title: z.string().trim().max(150).nullable().optional(),

	support_type: z.enum([
		'installation',
		'configuration',
		'deployment',
		'migration',
		'microsoft_365',
		'cloud',
		'network',
		'device_setup',
		'other',
	]),

	product_or_service: z.string().trim().max(250).nullable().optional(),

	issue_summary: z.string().trim().min(10, 'Tell us briefly what support you need.').max(1000),

	requirements: z.string().trim().max(5000).nullable().optional(),

	preferred_date: z
		.string()
		.trim()
		.nullable()
		.optional()
		.refine(
			(value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
			'Enter a valid preferred date.',
		),

	location: z.string().trim().max(500).nullable().optional(),

	source: z.string().trim().max(100).default('technical_support_page'),
});

export type TechnicalSupportRequestInput = z.infer<typeof technicalSupportRequestSchema>;
