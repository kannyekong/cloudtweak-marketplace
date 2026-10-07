import { tweakmartSupabase } from './supabase-server';

export interface StorefrontCategory {
	id: string;
	parent_id: string | null;
	name: string;
	slug: string;
	description: string | null;
	image_url: string | null;
	display_order: number;
	featured: boolean;
}

/* Searches active TweakMart categories by their customer-facing content. */
export async function searchStorefrontCategories(search: string, limit = 6) {
	const searchTerm = search.trim();

	if (!searchTerm) {
		return [];
	}

	const { data, error } = await tweakmartSupabase
		.from('categories')
		.select(
			`
			id,
			parent_id,
			name,
			slug,
			description,
			image_url,
			display_order,
			featured
		`,
		)
		.eq('is_active', true)
		.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
		.order('display_order', {
			ascending: true,
		})
		.limit(limit);

	if (error) {
		throw new Error(`Unable to search TweakMart categories: ${error.message}`);
	}

	return (data ?? []) as StorefrontCategory[];
}

/* Loads active TweakMart categories for storefront navigation and browsing. */
export async function getStorefrontCategories() {
	const { data, error } = await tweakmartSupabase
		.from('categories')
		.select(
			`
        id,
        parent_id,
        name,
        slug,
        description,
        image_url,
        display_order,
        featured
      `,
		)
		.eq('is_active', true)
		.is('parent_id', null)
		.order('display_order', {
			ascending: true,
		})
		.order('name', {
			ascending: true,
		});

	if (error) {
		throw new Error(`Unable to load TweakMart storefront categories: ${error.message}`);
	}

	return (data ?? []) as StorefrontCategory[];
}

/* Loads featured active categories for the TweakMart homepage. */
export async function getFeaturedStorefrontCategories(limit = 6) {
	const { data, error } = await tweakmartSupabase
		.from('categories')
		.select(
			`
        id,
        parent_id,
        name,
        slug,
        description,
        image_url,
        display_order,
        featured
      `,
		)
		.eq('is_active', true)
		.eq('featured', true)
		.order('display_order', {
			ascending: true,
		})
		.order('name', {
			ascending: true,
		})
		.limit(limit);

	if (error) {
		throw new Error(`Unable to load featured TweakMart categories: ${error.message}`);
	}

	return (data ?? []) as StorefrontCategory[];
}

/* Loads one active category using its storefront slug. */
/* Loads one active TweakMart category using its storefront slug. */
export async function getStorefrontCategoryBySlug(slug: string) {
	console.log('[TweakMart category] Requested slug:', JSON.stringify(slug));

	const { data, error } = await tweakmartSupabase
		.from('categories')
		.select(
			`
			id,
			parent_id,
			name,
			slug,
			description,
			image_url,
			display_order,
			featured,
			is_active
		`,
		)
		.eq('slug', slug)
		.maybeSingle();

	if (error) {
		throw new Error(`Unable to load TweakMart category: ${error.message}`);
	}

	return data;
}
