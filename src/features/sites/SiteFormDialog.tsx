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
import { PRODUCT_STATUS_LABELS } from "@/features/factory/operations-labels";
import { MARKET_LABELS } from "./site-labels";

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
            : "제품을 삭제하지 못했습니다.",
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
              : "제품을 저장하지 못했습니다. 다시 시도하세요.",
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
        aria-label={mode === "create" ? "제품 등록" : "제품 편집"}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {mode === "create" ? "제품 등록" : "제품 편집"}
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          aria-label="제품 등록 단계"
          className="mt-4 flex flex-wrap gap-2 text-sm"
        >
          {["제품 정보", "연결 서비스 식별 정보", "준비 상태"].map(
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
          제품 등록 안내 보기
        </a>
        <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <h3 id={`${sectionId}-0`} className="font-semibold">
            1. 제품 정보
          </h3>
          <p className="text-xs text-muted-foreground">
            제품 상태는 사업 진행 단계를 나타냅니다. 상태를 바꾸어도 수집이
            활성화되지는 않습니다.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              제품 코드
              <Input {...register("product_code")} placeholder="P001" />
            </label>
            <label className="text-sm">
              제품 상태
              <select className="factory-input" {...register("status")}>
                {PRODUCT_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {PRODUCT_STATUS_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              대상 시장
              <select className="factory-input" {...register("market")}>
                {MARKETS.map((v) => (
                  <option key={v} value={v}>
                    {MARKET_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              대표 언어
              <Input {...register("primary_language")} />
            </label>
            <label className="text-sm">
              제품 단계
              <select
                className="factory-input"
                {...register("level", { valueAsNumber: true })}
              >
                {[1, 2, 3].map((v) => (
                  <option key={v} value={v}>
                    제품 단계 {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              버전
              <Input {...register("version")} />
            </label>
            <label className="text-sm">
              출시일
              <Input type="date" {...register("launch_date")} />
            </label>
          </div>
          <Field label="제품 이름" error={errors.name?.message}>
            <Input
              {...register("name", { required: "제품 이름을 입력하세요." })}
              placeholder="예시 블로그"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="도메인" error={errors.domain?.message}>
              <Input
                {...register("domain", { required: "도메인을 입력하세요." })}
                placeholder="example.com"
              />
            </Field>
            <Field label="사이트 주소" error={errors.website_url?.message}>
              <Input
                {...register("website_url", {
                  required: "사이트 주소를 입력하세요.",
                })}
                placeholder="https://example.com"
              />
            </Field>
          </div>

          <h3 id={`${sectionId}-1`} className="font-semibold">
            2. 연결 서비스 식별 정보
          </h3>
          <p className="text-xs text-muted-foreground">
            확인한 식별 정보만 입력하세요. 설정을 입력해도 인증이나 보고서
            접근이 성공했다는 뜻은 아닙니다.
          </p>
          <Field
            label="GSC 속성"
            hint="도메인 속성: sc-domain:example.com · URL 접두어 속성: 전체 주소"
          >
            <Input
              {...register("gsc_property")}
              placeholder="sc-domain:example.com"
            />
          </Field>

          <Field label="GA4 속성 ID" hint="G-XXXX 코드가 아닌 숫자 ID">
            <Input {...register("ga4_property_id")} placeholder="483920114" />
          </Field>

          <Field
            label="Bing 사이트 주소"
            hint="Bing을 사용하지 않으면 비워두세요."
          >
            <Input
              {...register("bing_site_url")}
              placeholder="https://example.com/"
            />
          </Field>

          <label className="block text-sm">
            GitHub 저장소 주소
            <Input
              {...register("github_repo")}
              placeholder="https://github.com/owner/repository"
            />
          </label>
          <label className="block text-sm">
            배포 주소
            <Input
              {...register("deploy_url")}
              placeholder="https://example.pages.dev"
            />
          </label>
          <label className="block text-sm">
            AdSense에서 확인한 사이트 도메인
            <Input
              {...register("adsense_mapping_key")}
              placeholder="iposcore.kr"
            />
            <span className="text-xs text-muted-foreground">
              AdSense에 등록된 정확한 사이트 도메인입니다. 도메인 하나는 제품
              하나에 연결됩니다.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("adsense_enabled")} /> AdSense
            사용
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_active")} />
            수집 활성화
          </label>
          <h3 id={`${sectionId}-2`} className="font-semibold">
            3. 저장 전 준비 상태
          </h3>
          <p className="text-xs text-muted-foreground">
            수집을 활성화하면 기존 예약 작업이 켜져 있을 때 이 제품을 예약
            수집과 가동 상태 확인에 포함합니다. 새 제품은 수집이 꺼진 상태로
            시작합니다. 이 화면에서는 인증 정보나 예약 작업의 실행 여부를 검증할
            수 없습니다.
          </p>
          <ul className="space-y-1 text-xs" aria-label="준비 상태 점검">
            <li>
              제품 정보:{" "}
              {watch("name") && watch("domain") && watch("website_url")
                ? "입력됨 · 저장 시 검증합니다."
                : "필수 항목이 누락되었습니다."}
            </li>
            <li>
              연결 서비스:{" "}
              {[
                watch("ga4_property_id") && "GA4",
                watch("gsc_property") && "GSC",
                watch("bing_site_url") && "Bing",
                watch("adsense_enabled") && "AdSense",
              ]
                .filter(Boolean)
                .join(", ") || "설정 없음 · 제품 등록은 가능합니다."}
            </li>
            <li>서비스 보고서 접근 권한과 예약 수집: 확인되지 않음</li>
            <li>
              수집 대상 여부:{" "}
              {watch("is_active")
                ? "활성화됨 · 저장 전 준비 상태를 확인하세요."
                : "직접 활성화하기 전까지 수집하지 않습니다."}
            </li>
          </ul>

          <div className="flex items-center justify-between gap-2 pt-2">
            {mode === "edit" && site ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    제품과 관련 데이터를 모두 삭제할까요?
                  </span>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    loading={deletion.isPending}
                    onClick={onDelete}
                  >
                    삭제
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    유지
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
                  제품 삭제
                </Button>
              )
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                {mode === "create" ? "제품 등록" : "변경 저장"}
              </Button>
            </div>
          </div>
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          식별 정보는 서비스 연결에 사용됩니다. 등록 후 보고서 접근 권한과 실제
          실행 기록을 별도로 확인하세요.
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
