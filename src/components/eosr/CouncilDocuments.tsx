import { useState } from "react";
import { toast } from "sonner";
import { buttonClass, EmptyRow, Field, ghostButtonClass, inputClass, LoadingRow, Panel, Pill } from "@/components/eosr/ui";
import { shortDate } from "@/lib/eosr";
import {
  DOC_TYPES,
  DOC_TYPE_LABEL,
  openCouncilDocument,
  useCouncilDocuments,
  useDeleteCouncilDocument,
  useUploadCouncilDocument,
  type CouncilDocument,
} from "@/lib/governance";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CouncilDocuments({
  councilId,
  councilName,
  editable,
  fiscalYear,
  uploadedBy,
}: {
  councilId: string;
  councilName: string;
  editable: boolean;
  fiscalYear: string;
  uploadedBy: string | null;
}) {
  const docs = useCouncilDocuments(councilId);
  const upload = useUploadCouncilDocument();
  const remove = useDeleteCouncilDocument();
  const [file, setFile] = useState<File | null>(null);

  async function handleOpen(doc: CouncilDocument) {
    try {
      await openCouncilDocument(doc.storage_path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open document");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Panel
        title="Council documents"
        meta={`${(docs.data ?? []).length} FILES · ${councilName.toUpperCase()}`}
        bodyClassName="p-0"
        className="xl:col-span-2"
      >
        {docs.isLoading ? (
          <LoadingRow />
        ) : (docs.data ?? []).length === 0 ? (
          <EmptyRow>No budget documents, minutes or spending reports uploaded yet</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="label-mono border-b border-line">
                <tr>
                  {["Uploaded", "Type", "Title", "FY", "File", "Size", ""].map((h) => (
                    <th key={h} className="px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(docs.data ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-line/60 last:border-0">
                    <td className="num px-4 py-2.5">{shortDate(d.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <Pill value={d.doc_type.replace(/_/g, " ")} />
                    </td>
                    <td className="px-4 py-2.5">{d.title}</td>
                    <td className="num px-4 py-2.5 text-muted-foreground">{d.fiscal_year}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.file_name}</td>
                    <td className="num px-4 py-2.5 text-muted-foreground">{fileSize(Number(d.file_size))}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button type="button" onClick={() => void handleOpen(d)} className={ghostButtonClass}>
                        OPEN
                      </button>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Remove "${d.title}"?`)) return;
                            remove.mutate(d, {
                              onSuccess: () => toast.success("Document removed"),
                              onError: (e) => toast.error(e.message),
                            });
                          }}
                          className={`${ghostButtonClass} ml-2`}
                        >
                          DELETE
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Upload document" meta="BUDGET · MINUTES · REPORTS">
        {!editable ? (
          <p className="text-[12px] text-muted-foreground">
            Only a system administrator or this council's administrator can upload documents.
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const f = new FormData(form);
              if (!file) {
                toast.error("Choose a file to upload");
                return;
              }
              upload.mutate(
                {
                  councilId,
                  file,
                  docType: String(f.get("doc_type")),
                  title: String(f.get("title")),
                  fiscalYear: String(f.get("fiscal_year") || fiscalYear),
                  notes: String(f.get("notes") || "") || null,
                  uploadedBy,
                },
                {
                  onSuccess: () => {
                    toast.success("Document uploaded");
                    form.reset();
                    setFile(null);
                  },
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            <Field label="Document type">
              <select name="doc_type" className={inputClass} defaultValue="BUDGET">
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input name="title" required className={inputClass} placeholder="Approved Budget FY 2026/27" />
            </Field>
            <Field label="Fiscal year">
              <input name="fiscal_year" defaultValue={fiscalYear} className={inputClass} />
            </Field>
            <Field label="File" hint="PDF, Word, Excel or image up to 25 MB">
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={inputClass}
              />
            </Field>
            <Field label="Notes">
              <input name="notes" className={inputClass} placeholder="Optional" />
            </Field>
            <button type="submit" disabled={upload.isPending} className={buttonClass}>
              {upload.isPending ? "UPLOADING…" : "UPLOAD DOCUMENT"}
            </button>
          </form>
        )}
      </Panel>
    </div>
  );
}
