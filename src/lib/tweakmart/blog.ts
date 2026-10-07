import { tweakmartSupabase } from './supabase-server';

export interface TweakMartBlogPost {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	content: unknown;
	cover_image: string | null;
	category: string | null;
	author: string | null;
	seo_title: string | null;
	seo_description: string | null;
	canonical_url: string | null;
	featured: boolean | null;
	published: boolean;
	views: number | null;
	likes_count: number;
	created_at: string;
	updated_at: string | null;
	published_at: string | null;
}

/* Returns all published TweakMart articles in publication order. */
export async function getPublishedTweakMartPosts() {
	const { data, error } = await tweakmartSupabase
		.from('blog_posts')
		.select('*')
		.eq('published', true)
		.order('published_at', {
			ascending: false,
			nullsFirst: false,
		})
		.order('created_at', {
			ascending: false,
		});

	if (error) {
		throw new Error(`Unable to load TweakMart articles: ${error.message}`);
	}

	return (data ?? []) as TweakMartBlogPost[];
}

/* Returns one published TweakMart article matching a public slug. */
export async function getTweakMartPostBySlug(slug: string) {
	const { data, error } = await tweakmartSupabase
		.from('blog_posts')
		.select('*')
		.eq('slug', slug)
		.eq('published', true)
		.maybeSingle();

	if (error) {
		throw new Error(`Unable to load TweakMart article: ${error.message}`);
	}

	return data as TweakMartBlogPost | null;
}

/* Returns other published articles for the related-reading section. */
export async function getRelatedTweakMartPosts(currentSlug: string, limit = 3) {
	const { data, error } = await tweakmartSupabase
		.from('blog_posts')
		.select('*')
		.eq('published', true)
		.neq('slug', currentSlug)
		.order('published_at', {
			ascending: false,
			nullsFirst: false,
		})
		.order('created_at', {
			ascending: false,
		})
		.limit(limit);

	if (error) {
		throw new Error(`Unable to load related TweakMart articles: ${error.message}`);
	}

	return (data ?? []) as TweakMartBlogPost[];
}
