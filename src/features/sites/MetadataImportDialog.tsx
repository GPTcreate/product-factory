import { useState } from "react";
import type { Site } from "@/types/database";
import type { SiteFormValues } from "@/lib/api";
import {
  previewMetadata,
  defaultMetadataSelection,
  selectedMetadataFields,
  type MetadataPreview,
} from "@/lib/product-metadata";
import { Button } from "@/components/ui/button";
import { MARKET_LABELS, METADATA_FIELD_LABELS } from "./site-labels";

function displayValue(key: string, value: unknown): string {
  if (value == null || value === "") return "비어 있음";
  if (typeof value === "boolean") return value ? "사용" : "사용 안 함";
  if (key === "market" && typeof value === "string")
    return MARKET_LABELS[value] ?? value;
  return String(value);
}

export function MetadataImportDialog({
  products,
  onClose,
  onApply,
}: {
  products: Site[];
  onClose: () => void;
  onApply: (site: Site | undefined, fields: Partial<SiteFormValues>) => void;
}) {
  const [preview, setPreview] = useState<MetadataPreview>();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="메타데이터 미리보기"
        className="mx-auto mt-10 w-full max-w-lg space-y-4 rounded-lg border bg-card p-5"
      >
        <h2 className="font-semibold">제품 메타데이터 가져오기</h2>
        <p className="text-sm">
          제품 생성 안내의 product.json 파일을 읽습니다. 등록 양식에 채울 항목을
          선택한 뒤 내용을 검토하고 저장하세요.
        </p>
        <label className="block text-sm">
          메타데이터 JSON 파일
          <input
            type="file"
            accept=".json,application/json"
            disabled={reading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setPreview(undefined);
              setError("");
              setSelected([]);
              if (!file) return;
              if (file.size > 128 * 1024) {
                setError("메타데이터 파일은 128KB 이하여야 합니다.");
                return;
              }
              setReading(true);
              try {
                const result = previewMetadata(await file.text(), products);
                setPreview(result);
                setSelected(defaultMetadataSelection(result));
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "메타데이터를 읽지 못했습니다.",
                );
              } finally {
                setReading(false);
              }
            }}
            className="mt-2 block w-full min-w-0"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {preview && (
          <>
            <p className="text-sm font-medium">
              {preview.site
                ? `기존 제품 편집: ${preview.site.name}`
                : "새 제품"}
            </p>
            <p className="text-xs">
              기존 서비스 식별 정보와 AdSense 연결은 선택하지 않은 상태로
              시작합니다. 변경할 항목을 직접 선택하세요.
            </p>
            <div className="space-y-2">
              {Object.entries(preview.fields).map(([key, value]) => (
                <label
                  key={key}
                  className="flex min-w-0 items-start gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={(event) =>
                      setSelected((keys) =>
                        event.target.checked
                          ? [...keys, key]
                          : keys.filter((k) => k !== key),
                      )
                    }
                  />
                  <span className="min-w-0 break-words">
                    {METADATA_FIELD_LABELS[key] ?? key}:{" "}
                    {displayValue(key, value)}
                    {preview.site &&
                      ` (현재: ${displayValue(key, preview.site[key as keyof Site])})`}
                  </span>
                </label>
              ))}
            </div>
            {preview.ignored.map((note) => (
              <p key={note} className="text-xs text-muted-foreground">
                {note}
              </p>
            ))}
            <Button
              disabled={!selected.length}
              onClick={() =>
                onApply(preview.site, selectedMetadataFields(preview, selected))
              }
            >
              등록 양식에 적용
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
      </section>
    </div>
  );
}
