import type { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { createClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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

export type ConsumeGenerationCreditsRow = {
  ok: boolean;
  code: "ok" | "no_credits" | "failed";
  current_credits: number | null;
  message: string | null;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  slides: Json | null;
  settings: Json | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProjectSlideRow = {
  id: string;
  project_id: string;
  position: number;
  name: string;
  background: string;
  elements: Json;
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
      projects: {
        Row: ProjectRow;
        Insert: Partial<ProjectRow> & { user_id: string };
        Update: Partial<ProjectRow>;
        Relationships: [];
      };
      project_slides: {
        Row: ProjectSlideRow;
        Insert: Partial<ProjectSlideRow> & Pick<ProjectSlideRow, "project_id" | "position" | "name" | "background" | "elements">;
        Update: Partial<ProjectSlideRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_generation_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_reason: string;
        };
        Returns: ConsumeGenerationCreditsRow[];
      };
    };
  };
};

export type AppRouteSupabaseClient = ReturnType<
  typeof createRouteHandlerClient<AppDatabase, "public", AppDatabase["public"]>
>;
export type AppServiceSupabaseClient = ReturnType<typeof createClient<AppDatabase>>;
