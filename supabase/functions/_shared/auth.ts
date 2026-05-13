import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

export function unauthorizedResponse(message = "Not authenticated", status = 401): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Verifies the Bearer JWT via Supabase Auth (cryptographic signature check).
 * Returns the user ID or throws an error.
 */
export async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const supabaseAdmin = createAdminClient();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }
  return user.id;
}

/**
 * Verifies the Bearer JWT and checks that the user has admin-or-higher role.
 */
export async function requireAdmin(req: Request): Promise<string> {
  const userId = await requireAuth(req);
  const supabaseAdmin = createAdminClient();
  const { data: isAdmin, error } = await supabaseAdmin.rpc("is_admin_or_higher", { _user_id: userId });
  if (error || !isAdmin) {
    throw Object.assign(new Error("Not authorized - admin role required"), { status: 403 });
  }
  return userId;
}

/**
 * Validates the x-cron-secret header against the CRON_SECRET env var
 * using a constant-time comparison.
 */
export function requireCronSecret(req: Request): void {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret) {
    throw Object.assign(new Error("CRON_SECRET not configured"), { status: 500 });
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!timingSafeEqual(provided, secret)) {
    throw Object.assign(new Error("Not authorized - invalid cron secret"), { status: 401 });
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}
