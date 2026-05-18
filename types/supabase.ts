import type { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { createClient } from "@supabase/supabase-js";

export type ProfileRow = {
  id: string;
  name: string | null;
  role: string | null;
  topic: string | null;
  credits: number | null;
  is_admin: boolean | null;
  created_at: string | null;
};

export type CreditsLogRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string | null;
};

export type AppDatabase = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      credits_log: {
        Row: CreditsLogRow;
        Insert: Pick<CreditsLogRow, "user_id" | "amount" | "reason"> & Partial<CreditsLogRow>;
        Update: Partial<CreditsLogRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type AppRouteSupabaseClient = ReturnType<
  typeof createRouteHandlerClient<AppDatabase, "public", AppDatabase["public"]>
>;
export type AppServiceSupabaseClient = ReturnType<typeof createClient<AppDatabase>>;
