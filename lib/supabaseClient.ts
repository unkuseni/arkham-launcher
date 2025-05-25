import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseInstance: SupabaseClient | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
	// Client-side instance (uses anon key)
	supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
	console.warn(
		"Supabase URL or Anon Key is not set. Supabase client not initialized. Please check your environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).",
	);
}

if (supabaseUrl && supabaseServiceRoleKey) {
	// Server-side admin instance (uses service role key)
	supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

export const supabase = supabaseInstance;
export const supabaseAdmin = supabaseAdminInstance;

export interface Database {
	public: {
		Tables: {
			r2_uploads: {
				Row: {
					id: string;
					key: string;
					url: string;
					uploaded_at: string;
					creator_wallet_address: string;
					created_at?: string;
					updated_at?: string;
				};
				Insert: {
					key: string;
					url: string;
					uploaded_at: string;
					creator_wallet_address: string;
				};
				Update: {
					key?: string;
					url?: string;
					uploaded_at?: string;
					creator_wallet_address?: string;
				};
			};
			keypairs: {
				Row: {
					id: string;
					creator_wallet_address: string;
					keypair_public_key: string;
					r2_url: string;
					r2_key: string;
					encrypted: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					creator_wallet_address: string;
					keypair_public_key: string;
					r2_url: string;
					r2_key: string;
					encrypted?: boolean;
				};
				Update: {
					creator_wallet_address?: string;
					keypair_public_key?: string;
					r2_url?: string;
					r2_key?: string;
					encrypted?: boolean;
				};
			};
		};
	};
}
