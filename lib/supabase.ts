import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';

// Browser client (for client components — uses anon key, RLS enforced via user JWT)
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Route handler client (for API routes — reads user session from cookies, enforces RLS)
export async function createSupabaseRouteHandlerClient() {
  // Dynamic import to avoid bundling next/headers in client components
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Headers already sent in read-only contexts (e.g. Server Components)
          }
        },
      },
    }
  );
}

// Admin client (service role — bypasses RLS, for trusted server-side operations)
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Legacy alias used throughout existing API routes
export const createSupabaseServerClient = createSupabaseAdminClient;
