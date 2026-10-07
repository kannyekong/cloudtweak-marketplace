import { createClient } from '@supabase/supabase-js';

/* Reads the private TweakMart Supabase configuration for server-side operations only. */
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

/* Stops server-side operations when the private Supabase configuration is missing. */
if (!supabaseUrl || !supabaseServiceRoleKey) {
	throw new Error('Missing TweakMart server Supabase environment variables.');
}

/* Creates the private Supabase client used only by trusted TweakMart server routes. */
export const tweakmartSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});
