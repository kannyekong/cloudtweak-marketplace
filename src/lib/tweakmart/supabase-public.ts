import { createClient } from '@supabase/supabase-js';

const tweakMartSupabaseUrl = import.meta.env.PUBLIC_TWEAKMART_SUPABASE_URL;

const tweakMartAnonKey = import.meta.env.PUBLIC_TWEAKMART_SUPABASE_ANON_KEY;

if (!tweakMartSupabaseUrl || !tweakMartAnonKey) {
	throw new Error('Missing public TweakMart Supabase configuration.');
}

/* Creates the public Supabase client used by the TweakMart storefront. */
export const tweakMartPublicSupabase = createClient(tweakMartSupabaseUrl, tweakMartAnonKey, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
	},
});
