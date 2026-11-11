import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { CoverageRow } from "@/lib/insights";
import { SOURCE_LABEL } from "@/lib/sources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrivacyMode } from "@/lib/privacy";

export function CoveragePanel({ coverage }: { coverage: CoverageRow[] }) {
  const privacy = usePrivacyMode();
  const gaps = coverage.filter((c) => c.hasGap);
  const current = coverage.length - gaps.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>자료 수집 범위</CardTitle>
        <span className="text-xs text-muted-foreground">
          {privacy.enabled
            ? `${privacy.maskNumber(current, "coverage:current")}/${privacy.maskNumber(
                coverage.length,
                "coverage:total",
              )}`
            : `${current}/${coverage.length}`}{" "}
          개 연결에 최근 자료 있음
        </span>
      </CardHeader>
      <CardContent>
        {gaps.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            활성화된 모든 연결에 최근 자료가 있습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {gaps.map((c) => (
              <li
                key={`${c.siteId}-${c.source}`}
                className="flex items-start gap-2 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <span className="font-medium">
                    {privacy.maskText(c.siteName, `coverage:${c.siteId}:name`)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    · {SOURCE_LABEL[c.source]}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {privacy.enabled
                      ? "마지막 자료 ********"
                      : c.lastDataDate
                        ? `마지막 자료 ${c.lastDataDate} (${c.staleDays}일 전)`
                        : "저장된 자료 없음"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
