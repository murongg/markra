import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, CircleAlert, Loader2, Wrench, X } from "lucide-react";
import type { AiAgentProcessItem } from "@markra/ai";
import { AiMarkdownMessage } from "./AiMarkdownMessage";
import type { I18nKey } from "@markra/shared";

type AiAgentProcessListProps = {
  activities: AiAgentProcessItem[];
  translate: (key: I18nKey) => string;
};

export function AiAgentProcessList({ activities, translate }: AiAgentProcessListProps) {
  const visibleActivities = activities.filter(
    (activity) => activity.kind === "tool_call" || activity.kind === "assistant_message"
  );
  const groupedActivities = groupActivitiesByTurn(visibleActivities);
  const hasRunningProcess = activities.some((activity) => activity.status === "running");
  const hasFailedProcess = activities.some((activity) => activity.status === "error");
  const flowComplete = visibleActivities.length > 0 && !hasRunningProcess && !hasFailedProcess;
  const [flowExpanded, setFlowExpanded] = useState(() => !flowComplete);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const hadRunningActivityRef = useRef(hasRunningProcess);
  const previousFlowCompleteRef = useRef(flowComplete);

  useEffect(() => {
    if (hasRunningProcess) {
      hadRunningActivityRef.current = true;
      previousFlowCompleteRef.current = flowComplete;
      setFlowExpanded(true);
      return;
    }

    const becameComplete = flowComplete && !previousFlowCompleteRef.current;
    previousFlowCompleteRef.current = flowComplete;

    if (!flowComplete) return;
    if (!becameComplete && !hadRunningActivityRef.current) return;

    hadRunningActivityRef.current = false;
    setFlowExpanded(false);
  }, [flowComplete, hasRunningProcess]);

  if (!groupedActivities.length) return null;

  return (
    <div className="grid gap-2">
      {flowComplete ? (
        <button
          aria-expanded={flowExpanded}
          className="inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1 py-0.5 text-left text-[11px] leading-4 text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
          type="button"
          onClick={() => setFlowExpanded((expanded) => !expanded)}
        >
          <ChevronDown
            aria-hidden="true"
            className={`shrink-0 text-(--text-tertiary) transition-transform duration-180 ease-out ${
              flowExpanded ? "rotate-0" : "-rotate-90"
            }`}
            size={12}
          />
          <Check aria-hidden="true" className="shrink-0 text-(--text-tertiary)" size={12} />
          <span className="truncate font-[540]">{processSummaryLabel(visibleActivities.length, translate)}</span>
          <span className="ml-auto shrink-0 text-[10px] font-[540] text-(--text-tertiary)">
            {translate("app.aiAgentProcessStatusCompleted")}
          </span>
        </button>
      ) : null}
      {flowExpanded ? (
        <div className="grid gap-3">
          {groupedActivities.map((group) => (
            <div className="relative pl-4" key={`turn:${group.turn}`}>
              {group.items.length > 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-3 bottom-3 left-1.25 w-px rounded-full bg-[color-mix(in_oklab,var(--border-default)_58%,transparent)]"
                />
              ) : null}
              <div className="grid gap-1.5">
                {group.items.map((activity) => {
                  const StatusIcon = statusIconForActivity(activity);
                  const hasDetails = Boolean(activity.rawLabel || activity.detail);
                  const expanded = expandedItems[activity.id] ?? false;
                  const showDetails = activity.status === "error" ? true : expanded;

                  if (activity.kind === "assistant_message") {
                    return (
                      <div
                        className="relative rounded-lg bg-(--bg-primary) px-3 py-2 text-[12px] leading-5 text-(--text-secondary)"
                        key={activity.id}
                      >
                        <span
                          aria-hidden="true"
                          className="absolute top-3.5 -left-3.5 size-2 rounded-full border border-[color-mix(in_oklab,var(--border-default)_74%,transparent)] bg-(--bg-secondary)"
                        />
                        <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] leading-4 font-[560] text-(--text-tertiary)">
                          <Bot aria-hidden="true" size={11} />
                          <span>{translate("app.aiAgent")}</span>
                        </div>
                        <AiMarkdownMessage content={activity.label} />
                      </div>
                    );
                  }

                  return (
                    <div
                      className={`relative grid gap-0.5 rounded-md px-1 py-0.5 text-[11px] leading-4 ${
                        activity.status === "error" ? "text-(--danger)" : "text-(--text-secondary)"
                      }`}
                      key={activity.id}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-2 -left-3.5 size-2 rounded-full border bg-(--bg-secondary) ${
                          activity.status === "running"
                            ? "border-(--accent) shadow-[0_0_0_2px_color-mix(in_oklab,var(--accent)_12%,transparent)]"
                            : activity.status === "error"
                              ? "border-(--danger)"
                              : "border-(--border-default)"
                        }`}
                      />
                      <button
                        aria-expanded={hasDetails ? showDetails : undefined}
                        className="inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-0 py-0 text-left text-current transition-colors duration-150 ease-out focus-visible:outline-none"
                        disabled={!hasDetails}
                        type="button"
                        onClick={
                          hasDetails
                            ? () =>
                                setExpandedItems((currentState) => ({
                                  ...currentState,
                                  [activity.id]: !showDetails
                                }))
                            : undefined
                        }
                      >
                        {hasDetails ? (
                          <ChevronDown
                            aria-hidden="true"
                            className={`shrink-0 text-(--text-tertiary) transition-transform duration-180 ease-out ${
                              showDetails ? "rotate-0" : "-rotate-90"
                            }`}
                            size={11}
                          />
                        ) : null}
                        <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-(--bg-secondary) text-(--text-tertiary)">
                          <Wrench
                            aria-hidden="true"
                            className={
                              activity.status === "running" ? "animate-pulse text-(--accent)" : "text-(--text-tertiary)"
                            }
                            size={12}
                          />
                        </span>
                        <span className="truncate">{activity.label}</span>
                        <span className={`ml-auto shrink-0 text-[10px] font-[540] ${statusTextClassName(activity)}`}>
                          {statusTextForActivity(activity, translate)}
                        </span>
                        <span className="ml-1 shrink-0">
                          <StatusIcon aria-hidden="true" className={statusClassName(activity)} size={11} />
                        </span>
                      </button>
                      {showDetails && hasDetails ? (
                        <div className="pl-5 text-[10px] leading-4 text-(--text-tertiary)">
                          {activity.rawLabel ? (
                            <span className="font-mono text-[9.5px] tracking-[0.01em] text-(--text-tertiary)">
                              {activity.rawLabel}
                            </span>
                          ) : null}
                          {activity.rawLabel && activity.detail ? <span className="px-1 text-(--text-tertiary)">·</span> : null}
                          {activity.detail ? <span>{activity.detail}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function groupActivitiesByTurn(activities: AiAgentProcessItem[]) {
  const groups = new Map<number, { items: AiAgentProcessItem[]; turn: number }>();

  for (const activity of activities) {
    const currentGroup = groups.get(activity.turn) ?? { items: [], turn: activity.turn };
    currentGroup.items.push(activity);
    groups.set(activity.turn, currentGroup);
  }

  return [...groups.values()].sort((left, right) => left.turn - right.turn);
}

function statusIconForActivity(activity: AiAgentProcessItem) {
  if (activity.status === "running") return Loader2;
  if (activity.status === "error") return CircleAlert;
  if (activity.status === "cancelled") return X;

  return Check;
}

function statusClassName(activity: AiAgentProcessItem) {
  if (activity.status === "running") return "animate-spin text-(--accent)";
  if (activity.status === "error") return "text-(--danger)";
  if (activity.status === "cancelled") return "text-(--text-tertiary)";

  return "text-(--text-tertiary)";
}

function statusTextForActivity(activity: AiAgentProcessItem, translate: (key: I18nKey) => string) {
  if (activity.status === "running") return translate("app.aiAgentProcessStatusRunning");
  if (activity.status === "error") return translate("app.aiAgentProcessStatusError");
  if (activity.status === "cancelled") return translate("app.aiAgentProcessStatusCancelled");

  return translate("app.aiAgentProcessStatusCompleted");
}

function statusTextClassName(activity: AiAgentProcessItem) {
  if (activity.status === "running") return "text-(--accent)";
  if (activity.status === "error") return "text-(--danger)";
  if (activity.status === "cancelled") return "text-(--text-tertiary)";

  return "text-(--text-tertiary)";
}

function processSummaryLabel(count: number, translate: (key: I18nKey) => string) {
  const unit = count === 1 ? translate("app.aiAgentProcessStep") : translate("app.aiAgentProcessSteps");
  return `${count} ${unit}`;
}
