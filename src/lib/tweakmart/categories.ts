import { supabase } from '../supabase';

export interface TweakMartCategory {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	image_url: string | null;
	is_active: boolean;
	featured: boolean;
	display_order: number;
	created_at: string | null;
	updated_at: string | null;
}

export interface TweakMartCategoryInput {
	name: string;
	slug: string;
	description: string | null;
	image_url: string | null;
	is_active: boolean;
	featured: boolean;
	display_order: number;
}

/* Generates a URL-friendly category slug. */
export function generateTweakMartCategorySlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/* Loads every TweakMart category for the administration interface. */
export async function getTweakMartCategories() {
	const { data, error } = await supabase
		.from('categories')
		.select('*')
		.order('display_order', {
			ascending: true,
		})
		.order('name', {
			ascending: true,
		});

	if (error) {
		throw new Error(`Unable to load categories: ${error.message}`);
	}

	return (data ?? []) as TweakMartCategory[];
}

/* Loads active categories for public storefront areas. */
export async function getActiveTweakMartCategories() {
	const { data, error } = await supabase
		.from('categories')
		.select('*')
		.eq('is_active', true)
		.order('display_order', {
			ascending: true,
		})
		.order('name', {
			ascending: true,
		});

	if (error) {
		throw new Error(`Unable to load storefront categories: ${error.message}`);
	}

	return (data ?? []) as TweakMartCategory[];
}

/* Loads active categories configured for homepage promotion. */
export async function getFeaturedTweakMartCategories(limit = 6) {
	const { data, error } = await supabase
		.from('categories')
		.select('*')
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
		throw new Error(`Unable to load featured categories: ${error.message}`);
	}

	return (data ?? []) as TweakMartCategory[];
}

/* Loads one active category using its public storefront slug. */
export async function getTweakMartCategoryBySlug(slug: string) {
	const { data, error } = await supabase
		.from('categories')
		.select('*')
		.eq('slug', slug)
		.eq('is_active', true)
		.maybeSingle();

	if (error) {
		throw new Error(`Unable to load category: ${error.message}`);
	}

	return data as TweakMartCategory | null;
}

/* Creates one TweakMart category. */
export async function createTweakMartCategory(values: TweakMartCategoryInput) {
	const { data, error } = await supabase
		.from('categories')
		.insert({
			name: values.name.trim(),
			slug: generateTweakMartCategorySlug(values.slug || values.name),
			description: values.description?.trim() || null,
			image_url: values.image_url?.trim() || null,
			is_active: values.is_active,
			featured: values.featured,
			display_order: Math.max(0, values.display_order),
		})
		.select()
		.single();

	if (error) {
		throw new Error(`Unable to create category: ${error.message}`);
	}

	return data as TweakMartCategory;
}

/* Updates one existing TweakMart category. */
export async function updateTweakMartCategory(id: string, values: TweakMartCategoryInput) {
	const { data, error } = await supabase
		.from('categories')
		.update({
			name: values.name.trim(),
			slug: generateTweakMartCategorySlug(values.slug || values.name),
			description: values.description?.trim() || null,
			image_url: values.image_url?.trim() || null,
			is_active: values.is_active,
			featured: values.featured,
			display_order: Math.max(0, values.display_order),
			updated_at: new Date().toISOString(),
		})
		.eq('id', id)
		.select()
		.single();

	if (error) {
		throw new Error(`Unable to update category: ${error.message}`);
	}

	return data as TweakMartCategory;
}

/* Deletes one category when no database constraint prevents the operation. */
export async function deleteTweakMartCategory(id: string) {
	const { error } = await supabase.from('categories').delete().eq('id', id);

	if (error) {
		throw new Error(`Unable to delete category: ${error.message}`);
	}
}
