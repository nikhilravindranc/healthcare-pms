"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Panel, PanelHeader, Select, SkeletonRows, StatusBadge, StatusDot } from "@/components/ui";
import { ApptActions } from "@/components/app/bits";
import { useUI } from "@/components/app/ui-state";
import { waitLabel } from "@/components/app/panels";
import { useAppointments, useFollowUps, useNow, useRefs } from "@/lib/hooks";
import { fmtLong, fmtTime, getPatient, pname, TODAY, toMin } from "@/lib/db";
import { useSession } from "@/lib/auth";
import type { Appointment } from "@/lib/types";

export default function OverviewPage() {
  const { data: appts, isLoading } = useAppointments();
  const { data: refs } = useRefs();
  const { data: fus } = useFollowUps();
  const session = useSession();
  const ui = useUI();
  const now = useNow();
  const [prov, setProv] = useState("");

  const today = useMemo(() => (appts ?? []).filter((a) => a.date === TODAY).sort((a, b) => a.time.localeCompare(b.time)), [appts]);
  const count = (...s: string[]) => today.filter((a) => s.includes(a.status)).length;
  const waiting = today.filter((a) => a.status === "waiting").sort((a, b) => (a.arrivedAt ?? 0) - (b.arrivedAt ?? 0));
  const rows = today.filter((a) => !prov || a.providerId === prov);
  const hour = Math.floor(now / 60);
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const who = session?.name.startsWith("Dr.") ? `Dr. ${session.name.split(" ").pop()}` : session?.first;
  const fOpen = fus?.filter((f) => f.status === "Open") ?? [];
  const fToday = fOpen.filter((f) => f.due === TODAY).length, fOver = fOpen.filter((f) => f.due < TODAY).length;

  const availability = (pid: string) => {
    const mine = today.filter((a) => a.providerId === pid);
    const live = mine.find((a) => a.status === "in_progress");
    if (live) return { label: "In visit", sub: pname(live.patientId), tone: "blue" as const };
    const w = mine.find((a) => a.status === "waiting");
    if (w) return { label: "Patient waiting", sub: pname(w.patientId), tone: "peach" as const };
    const next = mine.filter((a) => ["scheduled", "confirmed", "arrived"].includes(a.status) && toMin(a.time) >= now - 15).sort((a, b) => a.time.localeCompare(b.time))[0];
    return next ? { label: "Available", sub: `Next appointment ${next.time}`, tone: "mint" as const } : { label: "Available", sub: "No more appointments", tone: "mint" as const };
  };

  const activity = [
    { label: "Completed visits", n: count("completed") }, { label: "No-shows", n: count("no_show") },
    { label: "Cancellations", n: count("cancelled") }, { label: "New appointments", n: 3 },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{greet}, {who}</h1>
          <p className="mt-1 text-sm text-muted">{fmtLong(TODAY)}</p>
        </div>
        <dl className="flex divide-x divide-line rounded-lg border border-line bg-white" aria-label="Daily summary">
          {[["Appointments", today.length], ["Arrived", count("arrived", "waiting", "in_progress", "completed")], ["Waiting", count("waiting")], ["In progress", count("in_progress")]].map(([l, n]) => (
            <div key={l} className="px-4 py-2 text-center sm:px-5"><dd className="text-xl font-semibold leading-tight">{isLoading ? "–" : n}</dd><dt className="text-xs text-muted">{l}</dt></div>
          ))}
        </dl>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelHeader title="Today's schedule" sub={`${rows.length} appointments`} action={
            <Select sm aria-label="Filter by provider" value={prov} onChange={(e) => setProv(e.target.value)} className="w-40"><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>} />
          {isLoading ? <SkeletonRows rows={8} /> : rows.length === 0 ? <EmptyState title="No appointments today" text="Your schedule is clear." action={<Button onClick={() => ui.newAppt()}>New appointment</Button>} /> : (
            <ul className="divide-y divide-line">
              {rows.map((a) => <ScheduleRow key={a.id} a={a} now={now} onOpen={() => ui.openAppt(a.id)} />)}
            </ul>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Waiting now" sub={waiting.length ? `${waiting.length} patients` : undefined} action={<Link href="/front-desk" className="text-[13px] font-medium text-primary hover:underline">Front desk</Link>} />
            {isLoading ? <SkeletonRows rows={3} /> : waiting.length === 0 ? <EmptyState title="Nobody is waiting" text="Patients appear here after check-in." /> : (
              <ul className="divide-y divide-line">
                {waiting.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0"><Link href={`/patients/${a.patientId}`} className="font-medium hover:text-primary hover:underline">{pname(a.patientId)}</Link>
                        <p className="text-xs text-muted">{refs?.providers.find((p) => p.id === a.providerId)?.short} · {refs?.services.find((s) => s.id === a.serviceId)?.name}</p></div>
                      <Badge tone="peach"><StatusDot status="waiting" />{waitLabel(now, a.arrivedAt)}</Badge>
                    </div>
                    <div className="mt-2 flex gap-1.5"><ApptActions a={a} /><Link href={`/patients/${a.patientId}`}><Button size="sm" variant="ghost">Open patient</Button></Link></div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Provider availability" />
            <ul className="divide-y divide-line">
              {(refs?.providers ?? []).map((p) => {
                const av = availability(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={p.name} size={30} />
                    <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{p.short}</p><p className="truncate text-xs text-muted">{av.sub}</p></div>
                    <Badge tone={av.tone}>{av.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Follow-ups" action={<Link href="/follow-ups" className="text-[13px] font-medium text-primary hover:underline">Review</Link>} />
            <div className="grid grid-cols-2 divide-x divide-line">
              <Link href="/follow-ups" className="px-4 py-3 hover:bg-cloud/60"><p className="text-xl font-semibold">{fToday}</p><p className="text-xs text-muted">due today</p></Link>
              <Link href="/follow-ups" className="px-4 py-3 hover:bg-cloud/60"><p className="text-xl font-semibold text-[#8F2D2D]">{fOver}</p><p className="text-xs text-muted">overdue</p></Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Practice activity" sub="Today" />
            <ul className="grid grid-cols-2 gap-px bg-line">
              {activity.map((x) => <li key={x.label} className="bg-white px-4 py-3"><p className="text-lg font-semibold">{x.n}</p><p className="text-xs text-muted">{x.label}</p></li>)}
            </ul>
          </Panel>

          <button onClick={() => ui.evi()} className="flex w-full items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-3 text-left text-[13px] hover:bg-active">
            <Sparkles className="size-4 text-primary" aria-hidden /><span className="flex-1 font-medium">Ask EVI about your practice</span><span className="text-xs text-muted">Who is still waiting?</span>
          </button>
        </div>
      </div>
    </>
  );
}

function ScheduleRow({ a, now, onOpen }: { a: Appointment; now: number; onOpen: () => void }) {
  const { data: refs } = useRefs();
  const p = getPatient(a.patientId);
  const past = a.status === "completed" || a.status === "no_show" || a.status === "cancelled";
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 hover:bg-cloud/50 ${past ? "opacity-75" : ""}`}>
      <button onClick={onOpen} className="grid min-w-0 flex-1 grid-cols-[68px_minmax(0,1fr)_auto] items-center gap-x-3 text-left" aria-label={`Open appointment: ${pname(a.patientId)}, ${fmtTime(a.time)}`}>
        <span className="text-[13px] font-medium tabular-nums">{fmtTime(a.time).replace(" ", " ")}</span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium">{p?.first} {p?.last}</span>
          <span className="block truncate text-xs text-muted">{refs?.services.find((s) => s.id === a.serviceId)?.name} · {refs?.providers.find((x) => x.id === a.providerId)?.short} · {refs?.rooms.find((r) => r.id === a.roomId)?.name}</span>
        </span>
        <StatusBadge status={a.status} />
      </button>
      <div className="hidden shrink-0 sm:block" data-now={now}><ApptActions a={a} compact /></div>
    </li>
  );
}
