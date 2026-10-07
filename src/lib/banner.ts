import { supabase } from "./supabase";

export interface StorefrontBanner {
  id: string;
  title: string;
  image_url: string;
  alt_text: string | null;
  link_url: string | null;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
}

/* Retrieves active TweakMart banners that are currently eligible for storefront display. */
export async function getStorefrontBanners(): Promise<
  StorefrontBanner[]
> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("featured_banners")
    .select(
      `
        id,
        title,
        image_url,
        alt_text,
        link_url,
        display_order,
        starts_at,
        ends_at
      `
    )
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("display_order", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Failed to retrieve TweakMart storefront banners:",
      error
    );

    return [];
  }

  return data ?? [];
}