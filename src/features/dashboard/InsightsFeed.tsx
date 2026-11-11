import { Link } from "react-router-dom";
import {
  AlertTriangle,
  XCircle,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { Insight, InsightSeverity } from "@/lib/insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePrivacyMode } from "@/lib/privacy";

const STYLE: Record<InsightSeverity, { Icon: LucideIcon; tone: string }> = {
  critical: { Icon: XCircle, tone: "text-critical" },
  warning: { Icon: AlertTriangle, tone: "text-warning" },
  positive: { Icon: TrendingUp, tone: "text-success" },
  info: { Icon: Lightbulb, tone: "text-primary" },
};

export function InsightsFeed({ insights }: { insights: Insight[] }) {
  const privacy = usePrivacyMode();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>조치할 항목</CardTitle>
        <span className="text-xs text-muted-foreground">
          {privacy.enabled
            ? privacy.maskNumber(insights.length, "insights:count")
            : insights.length}{" "}
          개 항목
        </span>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            현재 확인이 필요한 항목이 없습니다.
          </div>
        ) : (
          <ul className="space-y-3">
            {insights.map((insight) => {
              const { Icon, tone } = STYLE[insight.severity];
              return (
                <li key={insight.id} className="flex gap-3">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {privacy.enabled ? "********" : insight.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {privacy.maskText(
                        insight.detail,
                        `insight:${insight.id}`,
                      )}
                    </p>
                    {insight.action && (
                      <p className="mt-0.5 text-xs">
                        <span className="text-muted-foreground">
                          →{" "}
                          {privacy.maskText(
                            insight.action,
                            `insight:${insight.id}:action`,
                          )}
                        </span>
                        {insight.siteId && (
                          <Link
                            to={`/sites/${insight.siteId}`}
                            className="ml-1 text-primary hover:underline"
                          >
                            제품 보기
                          </Link>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
