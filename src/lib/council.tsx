import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Council = { id: string; name: string; code: string; district: string };

type CouncilState = {
  councils: Council[];
  councilId: string | null;
  council: Council | null;
  setCouncilId: (id: string) => void;
};

const CouncilContext = createContext<CouncilState | null>(null);

export function useCouncils() {
  return useQuery({
    queryKey: ["councils"],
    queryFn: async () => {
      const { data, error } = await supabase.from("councils").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Council[];
    },
  });
}

export function CouncilProvider({ children }: { children: ReactNode }) {
  const { data: councils } = useCouncils();
  const [councilId, setCouncilId] = useState<string | null>(null);

  useEffect(() => {
    if (!councils?.length) return;
    setCouncilId((current) => {
      if (current && councils.some((c) => c.id === current)) return current;
      const stored =
        typeof window === "undefined" ? null : window.localStorage.getItem("eosr.council");
      if (stored && councils.some((c) => c.id === stored)) return stored;
      return councils[0]?.id ?? null;
    });
  }, [councils]);

  const value = useMemo<CouncilState>(
    () => ({
      councils: councils ?? [],
      councilId,
      council: councils?.find((c) => c.id === councilId) ?? null,
      setCouncilId: (id) => {
        setCouncilId(id);
        if (typeof window !== "undefined") window.localStorage.setItem("eosr.council", id);
      },
    }),
    [councils, councilId],
  );

  return <CouncilContext.Provider value={value}>{children}</CouncilContext.Provider>;
}

export function useCouncil(): CouncilState {
  const ctx = useContext(CouncilContext);
  if (!ctx) throw new Error("useCouncil must be used inside CouncilProvider");
  return ctx;
}
