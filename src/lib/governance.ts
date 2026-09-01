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

export type CouncilDocument = {
  id: string;
  council_id: string;
  doc_type: string;
  title: string;
  fiscal_year: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export const DOC_TYPES = ["BUDGET", "MINUTES", "SPENDING_REPORT", "OTHER"] as const;
export const DOC_TYPE_LABEL: Record<string, string> = {
  BUDGET: "Budget document",
  MINUTES: "Meeting minutes",
  SPENDING_REPORT: "Spending report",
  OTHER: "Other",
};
export const DOC_BUCKET = "council-documents";

export function useCouncilDocuments(councilId: string | null) {
  return useQuery({
    queryKey: ["council_documents", councilId],
    enabled: !!councilId,
    queryFn: () =>
      run<CouncilDocument[]>(
        supabase
          .from("council_documents")
          .select("*")
          .eq("council_id", councilId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useUploadCouncilDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      councilId: string;
      file: File;
      docType: string;
      title: string;
      fiscalYear: string;
      notes: string | null;
      uploadedBy: string | null;
    }) => {
      const safe = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${input.councilId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from(DOC_BUCKET).upload(path, input.file, {
        contentType: input.file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("council_documents").insert({
        council_id: input.councilId,
        doc_type: input.docType,
        title: input.title,
        fiscal_year: input.fiscalYear,
        storage_path: path,
        file_name: input.file.name,
        file_size: input.file.size,
        mime_type: input.file.type || "application/octet-stream",
        notes: input.notes,
        uploaded_by: input.uploadedBy,
      });
      if (error) {
        await supabase.storage.from(DOC_BUCKET).remove([path]);
        throw new Error(error.message);
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["council_documents"] }),
  });
}

export function useDeleteCouncilDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: CouncilDocument) => {
      const { error } = await supabase.from("council_documents").delete().eq("id", doc.id);
      if (error) throw new Error(error.message);
      await supabase.storage.from(DOC_BUCKET).remove([doc.storage_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["council_documents"] }),
  });
}

export async function openCouncilDocument(path: string) {
  const { data, error } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not open document");
  window.open(data.signedUrl, "_blank", "noopener");
}

/** All councils' governance rows at once — powers the multi-council dashboard. */
export function useAllGovernance() {
  return useQuery({
    queryKey: ["governance_all"],
    queryFn: async () => {
      const [b, s, m] = await Promise.all([
        supabase.from("council_budgets").select("*"),
        supabase.from("council_spending").select("*"),
        supabase.from("council_meetings").select("*").order("meeting_at"),
      ]);
      const err = b.error ?? s.error ?? m.error;
      if (err) throw new Error(err.message);
      return {
        budgets: (b.data ?? []) as CouncilBudget[],
        spending: (s.data ?? []) as CouncilSpending[],
        meetings: (m.data ?? []) as CouncilMeeting[],
      };
    },
  });
}
