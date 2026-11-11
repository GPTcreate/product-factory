import { useState } from "react";
import { ChevronDown, Download, FileJson, FileText, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DemoSite } from "@/features/demo/demo-data";
import {
  demoExportTables,
  demoReportRanges,
  demoSiteWithStatuses,
  demoSyncRuns,
} from "@/features/demo/demo-data";
import { cn } from "@/lib/utils";
import { readableError } from "@/lib/ui-errors";

type ExportFormat = "json" | "csv";

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[]): string {
  const headers = [
    ...new Set(
      rows.flatMap((row) =>
        row && typeof row === "object" && !Array.isArray(row)
          ? Object.keys(row)
          : [],
      ),
    ),
  ];
  if (!headers.length) return "";
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          csvCell(
            row && typeof row === "object" && !Array.isArray(row)
              ? (row as Record<string, unknown>)[header]
              : undefined,
          ),
        )
        .join(","),
    ),
  ].join("\n");
}

export function DemoPdfExportButton({ site }: { site: DemoSite }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPdf() {
    setExporting(true);
    setError(null);
    try {
      const { saveSitePerformanceReport } =
        await import("@/lib/site-report-pdf");
      await saveSitePerformanceReport({
        site: demoSiteWithStatuses(site),
        ranges: demoReportRanges(site),
        syncRuns: demoSyncRuns(site),
        generatedAt: new Date("2026-07-13T23:06:00.000Z"),
      });
    } catch (cause) {
      setError(
        readableError(
          cause,
          "예시 보고서를 내보내지 못했습니다. 다시 시도하세요.",
        ),
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        loading={exporting}
        onClick={() => void exportPdf()}
      >
        <FileText className="h-3.5 w-3.5" />
        예시 PDF 내보내기
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function DemoExportAllDataButton() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat | null>(null);

  async function exportData(nextFormat: ExportFormat) {
    setFormat(nextFormat);
    try {
      const data = demoExportTables();
      if (nextFormat === "json") {
        downloadBlob(
          "site-analytics-tool-demo-data.json",
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const [table, rows] of Object.entries(data.tables)) {
          zip.file(`${table}.csv`, toCsv(rows));
        }
        downloadBlob(
          "site-analytics-tool-demo-data-csv.zip",
          await zip.generateAsync({ type: "blob" }),
        );
      }
      setOpen(false);
    } finally {
      setFormat(null);
    }
  }

  const exporting = format !== null;
  return (
    <div className="relative">
      <button
        type="button"
        disabled={exporting}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {exporting ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {exporting ? "예시 자료 내보내는 중" : "예시 자료 내보내기"}
        {!exporting && <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="absolute bottom-11 z-10 w-full space-y-1 rounded-md border border-border bg-card p-1 shadow-lg">
          <ExportOption
            icon={FileJson}
            label="JSON"
            detail="예시 자료를 하나의 파일로 저장"
            onClick={() => void exportData("json")}
          />
          <ExportOption
            icon={Table}
            label="CSV ZIP"
            detail="표마다 CSV 파일로 저장"
            onClick={() => void exportData("csv")}
          />
        </div>
      )}
    </div>
  );
}

function ExportOption({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: typeof FileJson;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  );
}
