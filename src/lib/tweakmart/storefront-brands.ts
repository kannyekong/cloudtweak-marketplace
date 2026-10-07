import { tweakmartSupabase } from './supabase-server';

export interface StorefrontBrand {
	id: string;
	name: string;
	slug: string;
	logo_url: string | null;
}

/* Loads the brands available for storefront browsing from TweakMart Supabase. */
export async function getStorefrontBrands(): Promise<StorefrontBrand[]> {
	const { data, error } = await tweakmartSupabase
		.from('brands')
		.select(
			`
                        id,
                        name,
                        slug,
                        logo_url
                `,
		)
		.order('name', {
			ascending: true,
		});

	if (error) {
		console.error('Unable to load TweakMart brands:', error);

		return [];
	}

	return (data ?? []) as StorefrontBrand[];
}
