import {
  PRODUCT_STATUSES,
  MARKETS,
} from "../../../supabase/functions/_shared/product";
import { useId, useRef, useState } from "react";
import guideUrl from "../../../docs/PRODUCT_CREATION_AND_FACTORY_ONBOARDING.md?url";
import { onboardingError } from "@/lib/site-onboarding";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { useDeleteSite, useSaveSite } from "@/lib/hooks";
import { SaveSiteError, type SiteFormValues } from "@/lib/api";
import type { Site } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

function toDefaults(site?: Site): SiteFormValues {
  return {
    product_code: site?.product_code ?? "",
    market: site?.market ?? "Korea",
    primary_language: site?.primary_language ?? "ko",
    level: site?.level ?? 1,
    version: site?.version ?? "1.0",
    status: site?.status ?? "IDEA",
    launch_date: site?.launch_date ?? "",
    github_repo: site?.github_repo ?? "",
    deploy_url: site?.deploy_url ?? "",
    adsense_enabled: site?.adsense_enabled ?? false,
    adsense_mapping_key: site?.adsense_mapping_key ?? "",
    name: site?.name ?? "",
    domain: site?.domain ?? "",
    website_url: site?.website_url ?? "",
    gsc_property: site?.gsc_property ?? "",
    ga4_property_id: site?.ga4_property_id ?? "",
    bing_site_url: site?.bing_site_url ?? "",
    is_active: site?.is_active ?? false,
  };
}

export function SiteFormDialog({
  mode,
  site,
  onClose,
  onDeleted,
  preset,
  products = [],
}: {
  products?: Site[];
  preset?: Partial<SiteFormValues>;
  mode: "create" | "edit";
  site?: Site;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const mutation = useSaveSite();
  const sectionId = useId();
  const deletion = useDeleteSite();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Guard against accidental dismissal: a click only counts as a backdrop
  // dismissal when the press *started* on the backdrop. Without this, selecting
  // text in a field and releasing the mouse outside the dialog (a drag) fires a
  // click on the backdrop and closes the form mid-edit.
  const pressStartedOnBackdrop = useRef(false);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    pressStartedOnBackdrop.current = e.target === e.currentTarget;
  };
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && pressStartedOnBackdrop.current) {
      onClose();
    }
    pressStartedOnBackdrop.current = false;
  };

  const onDelete = () => {
    if (!site) return;
    setFormError(null);
    deletion.mutate(site.id, {
      onSuccess: () => (onDeleted ?? onClose)(),
      onError: (err) =>
        setFormError(
          err instanceof SaveSiteError
            ? err.message
            : "Could not delete the product.",
        ),
    });
  };
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SiteFormValues>({
    defaultValues: { ...toDefaults(site), ...preset },
  });

  const onSubmit = handleSubmit((values) => {
    const validation = onboardingError(values, products, site?.id);
    setFormError(validation);
    if (validation) return;
    mutation.mutate(
      {
        action: mode === "create" ? "create" : "update",
        id: site?.id,
        values,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) =>
          setFormError(
            err instanceof SaveSiteError
              ? err.message
              : "Could not save the product. Please try again.",
          ),
      },
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="mt-10 w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add product" : "Edit product"}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {mode === "create" ? "Add a product" : "Edit product"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          aria-label="Registration steps"
          className="mt-4 flex flex-wrap gap-2 text-sm"
        >
          {["Product information", "Provider identifiers", "Readiness"].map(
            (label, index) => (
              <button
                type="button"
                className="rounded border px-2 py-1"
                key={label}
                onClick={() =>
                  document
                    .getElementById(`${sectionId}-${index}`)
                    ?.scrollIntoView({ block: "start" })
                }
              >
                {index + 1}. {label}
              </button>
            ),
          )}
        </nav>
        <a
          className="mt-2 inline-block text-sm text-primary underline"
          href={guideUrl}
          target="_blank"
          rel="noreferrer"
        >
          Read onboarding guide
        </a>
        <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <h3 id={`${sectionId}-0`} className="font-semibold">
            1. Product information
          </h3>
          <p className="text-xs text-muted-foreground">
            Status tracks the business lifecycle. It does not enable collection.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Product code
              <Input {...register("product_code")} placeholder="P001" />
            </label>
            <label className="text-sm">
              Status
              <select className="factory-input" {...register("status")}>
                {PRODUCT_STATUSES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Market
              <select className="factory-input" {...register("market")}>
                {MARKETS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Language
              <Input {...register("primary_language")} />
            </label>
            <label className="text-sm">
              Level
              <select
                className="factory-input"
                {...register("level", { valueAsNumber: true })}
              >
                {[1, 2, 3].map((v) => (
                  <option key={v} value={v}>
                    Level {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Version
              <Input {...register("version")} />
            </label>
            <label className="text-sm">
              Launch date
              <Input type="date" {...register("launch_date")} />
            </label>
          </div>
          <Field label="Name" error={errors.name?.message}>
            <Input
              {...register("name", { required: "Name is required" })}
              placeholder="Example Blog"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Domain" error={errors.domain?.message}>
              <Input
                {...register("domain", { required: "Domain is required" })}
                placeholder="example.com"
              />
            </Field>
            <Field label="Website URL" error={errors.website_url?.message}>
              <Input
                {...register("website_url", {
                  required: "Website URL is required",
                })}
                placeholder="https://example.com"
              />
            </Field>
          </div>

          <h3 id={`${sectionId}-1`} className="font-semibold">
            2. Provider identifiers
          </h3>
          <p className="text-xs text-muted-foreground">
            Only enter identifiers you have verified. Configured does not mean
            authentication or report access has succeeded.
          </p>
          <Field
            label="GSC property"
            hint="Domain property: sc-domain:example.com · URL-prefix: full URL"
          >
            <Input
              {...register("gsc_property")}
              placeholder="sc-domain:example.com"
            />
          </Field>

          <Field label="GA4 property ID" hint="Numeric ID, not the G-XXXX code">
            <Input {...register("ga4_property_id")} placeholder="483920114" />
          </Field>

          <Field label="Bing site URL" hint="Leave blank if not using Bing">
            <Input
              {...register("bing_site_url")}
              placeholder="https://example.com/"
            />
          </Field>

          <label className="block text-sm">
            GitHub repository URL
            <Input
              {...register("github_repo")}
              placeholder="https://github.com/owner/repository"
            />
          </label>
          <label className="block text-sm">
            Deployment URL
            <Input
              {...register("deploy_url")}
              placeholder="https://example.pages.dev"
            />
          </label>
          <label className="block text-sm">
            AdSense verified site domain
            <Input
              {...register("adsense_mapping_key")}
              placeholder="iposcore.kr"
            />
            <span className="text-xs text-muted-foreground">
              Exact AdSense site domain. One domain maps to one product.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("adsense_enabled")} /> Enable
            AdSense
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_active")} />
            Active
          </label>
          <h3 id={`${sectionId}-2`} className="font-semibold">
            3. Readiness before saving
          </h3>
          <p className="text-xs text-muted-foreground">
            Active includes this product in scheduled collection and uptime
            checks when existing jobs are enabled. New products start inactive.
            This form cannot verify credentials or scheduled jobs.
          </p>
          <ul className="space-y-1 text-xs" aria-label="Readiness checks">
            <li>
              Product information:{" "}
              {watch("name") && watch("domain") && watch("website_url")
                ? "entered; validation occurs on save"
                : "required fields missing"}
            </li>
            <li>
              Providers:{" "}
              {[
                watch("ga4_property_id") && "GA4",
                watch("gsc_property") && "GSC",
                watch("bing_site_url") && "Bing",
                watch("adsense_enabled") && "AdSense",
              ]
                .filter(Boolean)
                .join(", ") || "none configured; registration can proceed"}
            </li>
            <li>Provider report access and scheduled collection: unverified</li>
            <li>
              Collection eligibility:{" "}
              {watch("is_active")
                ? "active; confirm readiness before saving"
                : "inactive until you enable it"}
            </li>
          </ul>

          <div className="flex items-center justify-between gap-2 pt-2">
            {mode === "edit" && site ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Delete product and all its data?
                  </span>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    loading={deletion.isPending}
                    onClick={onDelete}
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-critical"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete product
                </Button>
              )
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                {mode === "create" ? "Add product" : "Save changes"}
              </Button>
            </div>
          </div>
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          Provider identifiers configure integrations. Verify report access and
          original run evidence separately after registration.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-critical">{error}</p>}
    </label>
  );
}
