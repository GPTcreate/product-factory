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
        aria-label="Metadata preview"
        className="mx-auto mt-10 w-full max-w-lg space-y-4 rounded-lg border bg-card p-5"
      >
        <h2 className="font-semibold">Import product metadata</h2>
        <p className="text-sm">
          Read product.json from the creation guide. Choose fields to fill the
          registration form, then review and save separately.
        </p>
        <label className="block text-sm">
          Metadata JSON file
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
                setError("Metadata must be at most 128 KB.");
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
                    : "Could not read metadata.",
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
                ? `Edit existing product: ${preview.site.name}`
                : "New product"}
            </p>
            <p className="text-xs">
              Existing provider identifiers and AdSense mapping are unchecked.
              Select them explicitly to change them.
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
                    {key}: {String(value)}
                    {preview.site &&
                      ` (current: ${String(preview.site[key as keyof Site] ?? "empty")})`}
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
              Fill registration form
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </section>
    </div>
  );
}
