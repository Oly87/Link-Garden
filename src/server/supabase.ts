import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

let supabaseClient: any = null;

/**
 * Returns a lazily initialized Supabase client.
 * This prevents the application from crashing on startup if the environment
 * variables are not yet fully configured.
 */
export function getSupabase() {
  if (!supabaseClient) {
    let url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const key = serviceRoleKey || anonKey;
    
    if (!url || !key) {
      throw new Error("SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variables are required. Please configure them in your AI Studio environment settings.");
    }
    
    // Auto-clean trailing /rest/v1/ or /rest/v1 if present in URL
    url = url.trim().replace(/\/rest\/v1\/?$/, "");
    
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}
