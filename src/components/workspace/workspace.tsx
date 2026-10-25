"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Claim, DeductionRow, DocRow, QueryRow, StageEvent, TxnRow } from "@/lib/types";
import { TimelineTab } from "./timeline-tab";
import { QueriesTab } from "./queries-tab";
import { DeductionsTab } from "./deductions-tab";
import { SettlementTab } from "./settlement-tab";
import { DocumentsTab } from "./documents-tab";

const TABS = ["Timeline", "Queries", "Deductions", "Settlement", "Documents"] as const;
type Tab = (typeof TABS)[number];

export function Workspace(props: {
  claim: Claim;
  events: StageEvent[];
  queries: QueryRow[];
  deductions: DeductionRow[];
  txns: TxnRow[];
  docs: DocRow[];
}) {
  const [tab, setTab] = useState<Tab>("Timeline");
  const counts: Record<Tab, number> = {
    Timeline: props.events.length,
    Queries: props.queries.length,
    Deductions: props.deductions.length,
    Settlement: props.txns.length,
    Documents: props.docs.length,
  };

  return (
    <div className="mt-6">
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm",
              tab === t ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t}
            <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-xs text-muted">{counts[t]}</span>
          </button>
        ))}
      </div>

      {tab === "Timeline" && <TimelineTab claim={props.claim} events={props.events} />}
      {tab === "Queries" && <QueriesTab claim={props.claim} queries={props.queries} events={props.events} />}
      {tab === "Deductions" && <DeductionsTab claim={props.claim} lines={props.deductions} />}
      {tab === "Settlement" && <SettlementTab claim={props.claim} txns={props.txns} />}
      {tab === "Documents" && <DocumentsTab claim={props.claim} docs={props.docs} />}
    </div>
  );
}
