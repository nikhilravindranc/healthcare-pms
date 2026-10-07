"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, PageHeader, Panel, Sheet } from "@/components/ui";
import { PrepCard } from "@/components/app/evi";
import { AGENT_SPRITE, EviSprite } from "@/components/app/evi-mascot";
import { useUI } from "@/components/app/ui-state";
import { useAppointments, useFollowUps, useVisits } from "@/lib/hooks";
import { agents, prepSummary, type Finding } from "@/lib/insight";

export default function AgentsPage() { return <Suspense><Agents /></Suspense>; }

function Agents() {
  const params = useSearchParams();
  const router = useRouter();
  const ui = useUI();
  // Re-render when practice data changes so findings stay current.
  useAppointments(); useFollowUps(); useVisits();
  const [openId, setOpenId] = useState<string | null>(params.get("agent"));
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [prepFor, setPrepFor] = useState<string | null>(null);
  useEffect(() => { setOpenId(params.get("agent")); }, [params]);

  const agent = agents.find((a) => a.id === openId);
  const findings = useMemo(() => (agent ? agent.findings() : []), [agent, reviewed]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = findings.filter((f) => !reviewed.has(f.id));
  const close = () => { setOpenId(null); setPrepFor(null); router.replace("/agents"); };

  const actions = (f: Finding) => {
    const out: { label: string; run: () => void; primary?: boolean }[] = [];
    if (f.patientId) out.push({ label: "Open patient", run: () => router.push(`/patients/${f.patientId}`) });
    if (f.action === "schedule" && f.patientId) out.unshift({ label: "Schedule appointment", primary: true, run: () => ui.newAppt({ patientId: f.patientId }) });
    if (f.action === "reschedule" && f.apptId) out.unshift({ label: "Reschedule", primary: true, run: () => ui.openAppt(f.apptId!) });
    if (f.action === "open-appt" && f.apptId) out.unshift({ label: "Open appointment", primary: true, run: () => ui.openAppt(f.apptId!) });
    if (agent?.id === "prep" && f.apptId) out.unshift({ label: prepFor === f.id ? "Hide summary" : "Prepare visit", primary: true, run: () => setPrepFor(prepFor === f.id ? null : f.id) });
    if (f.href) out.unshift({ label: f.href === "/calendar" ? "Review schedule" : "Open reports", primary: true, run: () => router.push(f.href!) });
    return out;
  };

  return (
    <>
      <PageHeader title="AI agents" subtitle="Agents review practice data and surface items for your team. They never act without you." actions={<Button onClick={() => ui.evi()} variant="secondary">Ask EVI</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => (
          <Panel key={a.id} className="flex flex-col p-4">
            <div className="flex items-start gap-3"><EviSprite index={AGENT_SPRITE[a.id]} width={72} />
              <div><h2 className="text-[15px] font-semibold">{a.name}</h2><p className="mt-0.5 text-[13px] text-muted">{a.description}</p></div></div>
            <p className="mt-4 text-sm font-medium">{a.summary()}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">{a.actions.map((x) => <Badge key={x}>{x}</Badge>)}</div>
            <div className="mt-auto pt-4"><Button size="sm" variant="secondary" onClick={() => { setOpenId(a.id); router.replace(`/agents?agent=${a.id}`); }}>Review results</Button></div>
          </Panel>
        ))}
      </div>

      <Sheet open={!!agent} onOpenChange={(o) => !o && close()} width={520} title={agent?.name ?? ""} description={agent?.description}
        footer={pending.length > 0 && <Button variant="secondary" onClick={() => { setReviewed(new Set([...reviewed, ...findings.map((f) => f.id)])); toast.success("All results marked as reviewed"); }}><CheckCheck className="size-4" />Mark all as reviewed</Button>}>
        {agent && <div className="mb-4 flex items-center gap-3 rounded-lg bg-active/60 p-3"><EviSprite index={AGENT_SPRITE[agent.id]} width={64} /><p className="text-[13px] text-slate-600">{agent.summary()}. Review each item and mark it when done.</p></div>}
        {agent && (findings.length === 0 ? <EmptyState title="Nothing to review" text="This agent found nothing that needs attention." /> : (
          <ul className="space-y-3">
            {findings.map((f) => {
              const done = reviewed.has(f.id);
              return (
                <li key={f.id} className={`rounded-lg border border-line p-3.5 ${done ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{f.title}</p><p className="text-[13px] text-muted">{f.detail}</p></div>{done && <Badge tone="mint">Reviewed</Badge>}</div>
                  {!done && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actions(f).map((x) => <Button key={x.label} size="sm" variant={x.primary ? "primary" : "secondary"} onClick={x.run}>{x.label}</Button>)}
                      <Button size="sm" variant="ghost" onClick={() => setReviewed(new Set([...reviewed, f.id]))}>Mark reviewed</Button>
                    </div>)}
                  {prepFor === f.id && f.patientId && <PrepCard prep={prepSummary(f.patientId, f.apptId)} />}
                </li>
              );
            })}
          </ul>))}
        {agent?.id === "recall" && <p className="mt-4 text-xs text-muted">Outreach to these patients is handled in Campaigns, not in Practice Management.</p>}
      </Sheet>
    </>
  );
}
