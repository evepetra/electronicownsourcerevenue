import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type CouncilBudget = {
  id: string;
  council_id: string;
  fiscal_year: string;
  category: string;
  allocated_amount: number;
  notes: string | null;
  created_at: string;
};

export type CouncilSpending = {
  id: string;
  council_id: string;
  fiscal_year: string;
  category: string;
  description: string;
  amount: number;
  spent_on: string;
  department: string | null;
  created_at: string;
};

export type CouncilMeeting = {
  id: string;
  council_id: string;
  title: string;
  agenda: string | null;
  meeting_at: string;
  location: string;
  status: string;
  created_at: string;
};

async function run<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export function useCouncilBudgets(councilId: string | null) {
  return useQuery({
    queryKey: ["council_budgets", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<CouncilBudget[]>(
        supabase
          .from("council_budgets")
          .select("*")
          .eq("council_id", councilId!)
          .order("category"),
      ),
  });
}

export function useCouncilSpending(councilId: string | null) {
  return useQuery({
    queryKey: ["council_spending", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<CouncilSpending[]>(
        supabase
          .from("council_spending")
          .select("*")
          .eq("council_id", councilId!)
          .order("spent_on", { ascending: false }),
      ),
  });
}

export function useCouncilMeetings(councilId: string | null) {
  return useQuery({
    queryKey: ["council_meetings", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<CouncilMeeting[]>(
        supabase
          .from("council_meetings")
          .select("*")
          .eq("council_id", councilId!)
          .order("meeting_at", { ascending: true }),
      ),
  });
}

/** Server-side check: may the signed-in staff member edit this council's records? */
export function useCanManageCouncil(councilId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["can_manage_council", councilId, user?.id ?? "anon"],
    enabled: !!councilId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_manage_council", {
        _council_id: councilId!,
      });
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });
}

export function useGovernanceMutation(table: "council_budgets" | "council_spending" | "council_meetings") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { error } = await supabase.from(table).insert(row as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [table] }),
  });
}
