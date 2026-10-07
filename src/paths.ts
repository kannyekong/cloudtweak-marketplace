import type { Product } from "./lib/client.types.ts";

export const productPath = (slug: Product['slug']) => `/products/${slug}`;
export const categoryPath = (slug: string) => `/collections/${slug}`;