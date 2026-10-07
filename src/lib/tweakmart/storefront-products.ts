import { tweakmartSupabase } from './supabase-server';
import { getActiveProductOffers, type StorefrontProductOffer } from './storefront-offers';

export interface StorefrontProductImage {
	id: string;
	image_url: string;
	alt_text: string | null;
	is_primary: boolean;
	display_order: number;
}

export interface StorefrontInventory {
	quantity_available: number;
	quantity_reserved: number;
	available_stock: number;
	track_inventory: boolean;
	allow_backorder: boolean;
	in_stock: boolean;
}

export interface StorefrontProductVariant {
	id: string;
	name: string;
	sku: string;
	barcode: string | null;
	price: number | null;
	compare_at_price: number | null;
	attributes: Record<string, unknown>;
	weight_kg: number | null;
	is_default: boolean;
	inventory: StorefrontInventory;
}

export interface StorefrontCategory {
	id: string;
	name: string;
	slug: string;
}

export type StorefrontProductSort = 'recommended' | 'price-asc' | 'price-desc' | 'newest';

export interface GetStorefrontProductsOptions {
	featured?: boolean;
	categoryId?: string;
	categoryName?: string;
	categorySlug?: string;
	brandId?: string;
	productIds?: string[];
	productType?: string;
	search?: string;
	sort?: StorefrontProductSort;
	limit?: number;
}

export interface StorefrontProduct {
	id: string;
	name: string;
	slug: string;
	short_description: string | null;
	product_type: string;
	condition: string;
	base_price: number;
	compare_at_price: number | null;
	currency: string;
	featured: boolean;
	active_offer: StorefrontProductOffer | null;
	category: StorefrontCategory | null;

	brand: {
		id: string;
		name: string;
	} | null;

	primary_image: {
		id: string;
		image_url: string;
		alt_text: string | null;
	} | null;

	inventory: StorefrontInventory;
}

export interface StorefrontProductDetails extends StorefrontProduct {
	description: string | null;
	specifications: Record<string, unknown>;
	images: StorefrontProductImage[];
	variants: StorefrontProductVariant[];
}

/* Normalizes Supabase relations that may be returned as an object or array. */
function getSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
	if (!relation) {
		return null;
	}

	if (Array.isArray(relation)) {
		return relation[0] ?? null;
	}

	return relation;
}

/* Converts database numeric values into safe JavaScript numbers. */
function toNumber(value: unknown) {
	const parsedValue = Number(value);

	return Number.isFinite(parsedValue) ? parsedValue : 0;
}

/* Converts an unknown JSON value into a safe object. */
function toObject(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}

	return {};
}

/* Escapes characters that could interfere with PostgREST search expressions. */
function escapeSearchValue(value: string) {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/%/g, '\\%')
		.replace(/_/g, '\\_')
		.replace(/,/g, '\\,')
		.replace(/\(/g, '\\(')
		.replace(/\)/g, '\\)');
}

/* Calculates a normalized storefront inventory state from one or more inventory rows. */
function buildInventory(
	inventoryRows: Array<{
		quantity_available: number | string | null;
		quantity_reserved: number | string | null;
		track_inventory: boolean | null;
		allow_backorder: boolean | null;
	}>,
): StorefrontInventory {
	const quantityAvailable = inventoryRows.reduce(
		(total, inventory) => total + toNumber(inventory.quantity_available),
		0,
	);

	const quantityReserved = inventoryRows.reduce(
		(total, inventory) => total + toNumber(inventory.quantity_reserved),
		0,
	);

	const availableStock = Math.max(0, quantityAvailable - quantityReserved);

	const trackInventory = inventoryRows.some((inventory) => inventory.track_inventory);

	const allowBackorder = inventoryRows.some((inventory) => inventory.allow_backorder);

	const inStock = !trackInventory || availableStock > 0 || allowBackorder;

	return {
		quantity_available: quantityAvailable,
		quantity_reserved: quantityReserved,
		available_stock: availableStock,
		track_inventory: trackInventory,
		allow_backorder: allowBackorder,
		in_stock: inStock,
	};
}

/* Finds active category IDs whose names or descriptions match a search term. */
async function getMatchingCategoryIds(search: string) {
	const searchValue = escapeSearchValue(search.trim());

	if (!searchValue) {
		return [];
	}

	const { data, error } = await tweakmartSupabase
		.from('categories')
		.select('id')
		.eq('is_active', true)
		.or([`name.ilike.%${searchValue}%`, `description.ilike.%${searchValue}%`].join(','));

	if (error) {
		throw new Error(`Unable to search storefront categories: ${error.message}`);
	}

	return (data ?? []).map((category) => category.id);
}

/* Finds brand IDs whose names match a storefront search term. */
async function getMatchingBrandIds(search: string) {
	const searchValue = escapeSearchValue(search.trim());

	if (!searchValue) {
		return [];
	}

	const { data, error } = await tweakmartSupabase
		.from('brands')
		.select('id')
		.ilike('name', `%${searchValue}%`);

	if (error) {
		throw new Error(`Unable to search storefront brands: ${error.message}`);
	}

	return (data ?? []).map((brand) => brand.id);
}

/* Resolves an active category name to its database ID. */
async function getCategoryIdByName(categoryName: string) {
	const { data, error } = await tweakmartSupabase
		.from('categories')
		.select('id')
		.eq('name', categoryName)
		.eq('is_active', true)
		.maybeSingle();

	if (error) {
		throw new Error(`Unable to resolve storefront category: ${error.message}`);
	}

	return data?.id ?? null;
}

/* Resolves an active category slug to its database ID. */
async function getCategoryIdBySlug(categorySlug: string) {
	const { data, error } = await tweakmartSupabase
		.from('categories')
		.select('id')
		.eq('slug', categorySlug)
		.eq('is_active', true)
		.maybeSingle();

	if (error) {
		throw new Error(`Unable to resolve storefront category slug: ${error.message}`);
	}

	return data?.id ?? null;
}

/* Loads storefront products that are currently active and publicly published. */
export async function getStorefrontProducts({
	featured,
	categoryId,
	categoryName,
	categorySlug,
	brandId,
	productIds,
	productType,
	search,
	sort = 'recommended',
	limit = 12,
}: GetStorefrontProductsOptions = {}): Promise<StorefrontProduct[]> {
	let resolvedCategoryId = categoryId;

	/* Resolves a category slug before querying products. */
	if (!resolvedCategoryId && categorySlug) {
		resolvedCategoryId = await getCategoryIdBySlug(categorySlug);

		if (!resolvedCategoryId) {
			return [];
		}
	}

	/* Falls back to category name resolution when necessary. */
	if (!resolvedCategoryId && categoryName) {
		resolvedCategoryId = await getCategoryIdByName(categoryName);

		if (!resolvedCategoryId) {
			return [];
		}
	}

	let matchingCategoryIds: string[] = [];

	let matchingBrandIds: string[] = [];

	/* Resolves related category and brand matches for global storefront search. */
	if (search?.trim()) {
		[matchingCategoryIds, matchingBrandIds] = await Promise.all([
			getMatchingCategoryIds(search),
			getMatchingBrandIds(search),
		]);
	}

	let query = tweakmartSupabase
		.from('products')
		.select(
			`
				id,
				name,
				slug,
				short_description,
				description,
				product_type,
				condition,
				base_price,
				compare_at_price,
				currency,
				featured,
				published_at,
				category_id,
				brand_id,
				category:categories (
					id,
					name,
					slug
				),
				brand:brands (
					id,
					name
				)
			`,
		)
		.eq('status', 'active')
		.not('published_at', 'is', null);

	/* Restricts the query to featured products when requested. */
	if (featured !== undefined) {
		query = query.eq('featured', featured);
	}

	/* Restricts the query to the resolved storefront category. */
	if (resolvedCategoryId) {
		query = query.eq('category_id', resolvedCategoryId);
	}

	/* Restricts the query to a specific brand when requested. */
	if (brandId) {
		query = query.eq('brand_id', brandId);
	}

	/* Restricts the query to a supplied collection of product IDs. */
	if (productIds !== undefined) {
		if (productIds.length === 0) {
			return [];
		}

		query = query.in('id', productIds);
	}

	/* Restricts the query to a specific product type when requested. */
	if (productType) {
		query = query.eq('product_type', productType);
	}

	/* Searches product text while also including matching brands and categories. */
	if (search?.trim()) {
		const searchValue = escapeSearchValue(search.trim());

		const searchConditions = [
			`name.ilike.%${searchValue}%`,
			`short_description.ilike.%${searchValue}%`,
			`description.ilike.%${searchValue}%`,
		];

		/* Includes products whose assigned category matches the search term. */
		if (matchingCategoryIds.length > 0) {
			searchConditions.push(`category_id.in.(${matchingCategoryIds.join(',')})`);
		}

		/* Includes products whose assigned brand matches the search term. */
		if (matchingBrandIds.length > 0) {
			searchConditions.push(`brand_id.in.(${matchingBrandIds.join(',')})`);
		}

		query = query.or(searchConditions.join(','));
	}

	/* Applies the requested storefront sorting mode. */
	switch (sort) {
		case 'price-asc':
			query = query.order('base_price', {
				ascending: true,
			});
			break;

		case 'price-desc':
			query = query.order('base_price', {
				ascending: false,
			});
			break;

		case 'newest':
			query = query.order('published_at', {
				ascending: false,
			});
			break;

		case 'recommended':
		default:
			query = query
				.order('featured', {
					ascending: false,
				})
				.order('published_at', {
					ascending: false,
				});

			break;
	}

	query = query.limit(limit);

	const { data: products, error } = await query;

	if (error) {
		throw new Error(`Unable to load storefront products: ${error.message}`);
	}

	if (!products || products.length === 0) {
		return [];
	}

	const productIdsToLoad = products.map((product) => product.id);

	/*
	 * Loads images, variants and active offers in parallel because these
	 * requests are independent once the product IDs have been resolved.
	 */
	const [imagesResult, variantsResult, activeOffers] = await Promise.all([
		tweakmartSupabase
			.from('product_images')
			.select(
				`
					id,
					product_id,
					image_url,
					alt_text,
					is_primary,
					display_order
				`,
			)
			.in('product_id', productIdsToLoad)
			.order('display_order', {
				ascending: true,
			}),

		tweakmartSupabase
			.from('product_variants')
			.select(
				`
					id,
					product_id
				`,
			)
			.in('product_id', productIdsToLoad)
			.eq('is_active', true),

		getActiveProductOffers(productIdsToLoad),
	]);

	const { data: images, error: imagesError } = imagesResult;

	if (imagesError) {
		throw new Error(`Unable to load storefront product images: ${imagesError.message}`);
	}

	const { data: variants, error: variantsError } = variantsResult;

	if (variantsError) {
		throw new Error(`Unable to load storefront product variants: ${variantsError.message}`);
	}

	const variantIds = (variants ?? []).map((variant) => variant.id);

	/* Loads inventory after the active variant IDs have been resolved. */
	const { data: inventoryRows, error: inventoryError } =
		variantIds.length > 0
			? await tweakmartSupabase
					.from('inventory')
					.select(
						`
							variant_id,
							quantity_available,
							quantity_reserved,
							track_inventory,
							allow_backorder
						`,
					)
					.in('variant_id', variantIds)
			: {
					data: [],
					error: null,
				};

	if (inventoryError) {
		throw new Error(`Unable to load storefront inventory: ${inventoryError.message}`);
	}

	const variantProductMap = new Map<string, string>();

	/* Maps each variant back to its parent product for inventory aggregation. */
	for (const variant of variants ?? []) {
		variantProductMap.set(variant.id, variant.product_id);
	}

	/* Normalizes products and attaches their current active promotional offers. */
	return products.map((product) => {
		const category = getSingleRelation(product.category);

		const brand = getSingleRelation(product.brand);

		const productImages = (images ?? []).filter((image) => image.product_id === product.id);

		const primaryImage =
			productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;

		const productInventory = (inventoryRows ?? []).filter(
			(inventory) => variantProductMap.get(inventory.variant_id) === product.id,
		);

		const inventory = buildInventory(productInventory);

		return {
			id: product.id,
			name: product.name,
			slug: product.slug,

			short_description: product.short_description,

			product_type: product.product_type,

			condition: product.condition,

			base_price: toNumber(product.base_price),

			compare_at_price:
				product.compare_at_price === null ? null : toNumber(product.compare_at_price),

			currency: product.currency ?? 'NGN',

			featured: product.featured,

			active_offer: activeOffers.get(product.id) ?? null,

			category,
			brand,

			primary_image: primaryImage
				? {
						id: primaryImage.id,
						image_url: primaryImage.image_url,
						alt_text: primaryImage.alt_text,
					}
				: null,

			inventory,
		};
	});
}

/* Loads a single public product and all storefront information required by its product details page. */
export async function getStorefrontProductBySlug(
	slug: string,
): Promise<StorefrontProductDetails | null> {
	const { data: product, error: productError } = await tweakmartSupabase
		.from('products')
		.select(
			`
				id,
				name,
				slug,
				short_description,
				description,
				product_type,
				condition,
				base_price,
				compare_at_price,
				currency,
				featured,
				specifications,
				published_at,
				category:categories (
					id,
					name,
					slug
				),
				brand:brands (
					id,
					name
				)
			`,
		)
		.eq('slug', slug)
		.eq('status', 'active')
		.not('published_at', 'is', null)
		.maybeSingle();

	if (productError) {
		throw new Error(`Unable to load storefront product: ${productError.message}`);
	}

	if (!product) {
		return null;
	}

	/*
	 * Loads product images, active variants and the current promotional offer
	 * in parallel because each request only depends on the product ID.
	 */
	const [imagesResult, variantsResult, activeOffers] = await Promise.all([
		tweakmartSupabase
			.from('product_images')
			.select(
				`
					id,
					image_url,
					alt_text,
					is_primary,
					display_order
				`,
			)
			.eq('product_id', product.id)
			.order('display_order', {
				ascending: true,
			}),

		tweakmartSupabase
			.from('product_variants')
			.select(
				`
					id,
					name,
					sku,
					barcode,
					price,
					compare_at_price,
					attributes,
					weight_kg,
					is_default
				`,
			)
			.eq('product_id', product.id)
			.eq('is_active', true)
			.order('is_default', {
				ascending: false,
			})
			.order('created_at', {
				ascending: true,
			}),

		getActiveProductOffers([product.id]),
	]);

	const { data: images, error: imagesError } = imagesResult;

	if (imagesError) {
		throw new Error(`Unable to load product images: ${imagesError.message}`);
	}

	const { data: variants, error: variantsError } = variantsResult;

	if (variantsError) {
		throw new Error(`Unable to load product variants: ${variantsError.message}`);
	}

	const variantIds = (variants ?? []).map((variant) => variant.id);

	/* Loads inventory after resolving the active product variants. */
	const { data: inventoryRows, error: inventoryError } =
		variantIds.length > 0
			? await tweakmartSupabase
					.from('inventory')
					.select(
						`
							variant_id,
							quantity_available,
							quantity_reserved,
							track_inventory,
							allow_backorder
						`,
					)
					.in('variant_id', variantIds)
			: {
					data: [],
					error: null,
				};

	if (inventoryError) {
		throw new Error(`Unable to load product inventory: ${inventoryError.message}`);
	}

	/* Builds the image gallery while preserving the configured display order. */
	const productImages: StorefrontProductImage[] = (images ?? []).map((image) => ({
		id: image.id,
		image_url: image.image_url,
		alt_text: image.alt_text,
		is_primary: image.is_primary,
		display_order: image.display_order ?? 0,
	}));

	const primaryImage = productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;

	/* Builds each active variant with its own independent inventory state. */
	const storefrontVariants: StorefrontProductVariant[] = (variants ?? []).map((variant) => {
		const variantInventoryRows = (inventoryRows ?? []).filter(
			(inventory) => inventory.variant_id === variant.id,
		);

		return {
			id: variant.id,
			name: variant.name,
			sku: variant.sku,
			barcode: variant.barcode,

			price: variant.price === null ? null : toNumber(variant.price),

			compare_at_price:
				variant.compare_at_price === null ? null : toNumber(variant.compare_at_price),

			attributes: toObject(variant.attributes),

			weight_kg: variant.weight_kg === null ? null : toNumber(variant.weight_kg),

			is_default: variant.is_default,

			inventory: buildInventory(variantInventoryRows),
		};
	});

	/* Builds the aggregate product stock state from all active variants. */
	const productInventory = buildInventory(inventoryRows ?? []);

	const category = getSingleRelation(product.category);

	const brand = getSingleRelation(product.brand);

	/* Resolves the currently active promotional offer for the product. */
	const activeOffer = activeOffers.get(product.id) ?? null;

	return {
		id: product.id,
		name: product.name,
		slug: product.slug,

		short_description: product.short_description,

		description: product.description,

		product_type: product.product_type,

		condition: product.condition,

		base_price: toNumber(product.base_price),

		compare_at_price: product.compare_at_price === null ? null : toNumber(product.compare_at_price),

		currency: product.currency ?? 'NGN',

		featured: product.featured,

		active_offer: activeOffer,

		category,
		brand,

		primary_image: primaryImage
			? {
					id: primaryImage.id,
					image_url: primaryImage.image_url,
					alt_text: primaryImage.alt_text,
				}
			: null,

		inventory: productInventory,

		specifications: toObject(product.specifications),

		images: productImages,

		variants: storefrontVariants,
	};
}

/* Loads products marked as featured for promotional storefront areas. */
export async function getFeaturedProducts(limit = 10) {
	return getStorefrontProducts({
		featured: true,
		sort: 'recommended',
		limit,
	});
}

/* Loads recently published storefront products. */
export async function getLatestProducts(limit = 10) {
	return getStorefrontProducts({
		sort: 'newest',
		limit,
	});
}

/* Loads the products currently used by the Popular Products carousel. */
export async function getPopularProducts(limit = 10) {
	return getStorefrontProducts({
		featured: true,
		sort: 'recommended',
		limit,
	});
}

/* Loads active products belonging to a storefront category name. */
export async function getProductsByCategory(categoryName: string, limit = 10) {
	return getStorefrontProducts({
		categoryName,
		sort: 'recommended',
		limit,
	});
}

/* Loads active products belonging to a storefront category slug. */
export async function getProductsByCategorySlug(
	categorySlug: string,
	options: {
		sort?: StorefrontProductSort;
		limit?: number;
	} = {},
) {
	return getStorefrontProducts({
		categorySlug,
		sort: options.sort ?? 'recommended',
		limit: options.limit ?? 100,
	});
}
