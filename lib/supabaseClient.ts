import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
	supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
	console.warn(
		"Supabase URL or Anon Key is not set. Supabase client not initialized. Please check your environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).",
	);
}

export const supabase = supabaseInstance;
