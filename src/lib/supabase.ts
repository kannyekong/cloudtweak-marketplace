import { createClient } from '@supabase/supabase-js';

/* Reads the public Marketplace Supabase configuration. */
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/* Stops startup when the Marketplace Supabase configuration is missing. */
if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Marketplace Supabase environment variables.');
}

/* Creates the public Supabase client used by the Marketplace storefront. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
