"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Sparkles, Upload } from "lucide-react";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, Panel, PanelHeader, Skeleton, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger, Td, Th } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { PStatus } from "@/components/app/bits";
import { useAction, useAppointments, useFollowUps, usePatients, useRefs, useVisits } from "@/lib/hooks";
import { api, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { cn } from "@/lib/utils";

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: patients, isLoading } = usePatients();
  const { data: appts } = useAppointments();
  const { data: visits } = useVisits();
  const { data: fus } = useFollowUps();
  const { data: refs } = useRefs();
  const ui = useUI();
  const router = useRouter();
  const start = useAction(api.startVisit);
  const newVisit = useAction(api.newVisit);
  const complete = useAction(api.completeFollowUp, "Follow-up completed");
  const updateVisit = useAction(api.updateVisit, "Document deleted");
  const [delDoc, setDelDoc] = useState<{ visitId: string; formId: string; name: string } | null>(null);

  const p = patients?.find((x) => x.id === id);
  const myAppts = useMemo(() => (appts ?? []).filter((a) => a.patientId === id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [appts, id]);
  const myVisits = useMemo(() => (visits ?? []).filter((v) => v.patientId === id).sort((a, b) => b.date.localeCompare(a.date)), [visits, id]);
  const myFus = (fus ?? []).filter((f) => f.patientId === id).sort((a, b) => a.due.localeCompare(b.due));
  const prov = (pid: string) => refs?.providers.find((x) => x.id === pid)?.short ?? "";

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-20 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (!p) return <EmptyState title="Patient not found" text="This patient may have been removed." action={<Link href="/patients"><Button variant="secondary">Back to patients</Button></Link>} />;

  const upcoming = myAppts.filter((a) => a.date >= TODAY && !["completed", "cancelled", "no_show"].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const lastVisit = myVisits.find((v) => v.status === "Completed" && v.date <= TODAY && !(v.date === TODAY && upcoming));
  const openFus = myFus.filter((f) => f.status === "Open");
  const docs = myVisits.flatMap((v) => v.forms.map((f) => ({ ...f, visitId: v.id, date: v.date })));

  const startVisit = async () => {
    const ready = myAppts.find((a) => a.date === TODAY && ["scheduled", "confirmed", "arrived", "waiting", "in_progress"].includes(a.status));
    const v = ready ? await start.run(ready.id) : await newVisit.run(p.id, p.providerId ?? "pat");
    toast.success("Visit started"); router.push(`/visits/${v.id}`);
  };

  // Timeline: appointments not yet completed + documented visits, newest first
  const timeline = [
    ...myAppts.filter((a) => !a.visitId && a.status !== "completed").map((a) => ({ key: a.id, date: a.date, title: refs?.services.find((s) => s.id === a.serviceId)?.name ?? "", sub: `${prov(a.providerId)} · ${fmtTime(a.time)}`, kind: "appt" as const, a, onClick: () => ui.openAppt(a.id) })),
    ...myVisits.map((v) => ({ key: v.id, date: v.date, title: v.type, sub: `${prov(v.providerId)}${v.reason ? " · " + v.reason : ""}`, kind: "visit" as const, a: undefined, onClick: () => router.push(`/visits/${v.id}`), live: v.status === "In progress" })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <nav className="mb-3 text-[13px] text-muted"><Link href="/patients" className="hover:text-primary">Patients</Link> / {p.first} {p.last}</nav>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${p.first} ${p.last}`} size={52} />
          <div><div className="flex items-center gap-2"><h1 className="text-[26px] font-semibold leading-tight tracking-tight">{p.first} {p.last}</h1><PStatus s={p.status} /></div>
            <p className="text-sm text-muted">Patient ID: {p.id} · DOB {fmtDate(p.dob, true)} · {p.gender}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => ui.newAppt({ patientId: p.id })}>New appointment</Button>
          <Button variant="secondary" onClick={() => ui.newFollowUp({ patientId: p.id })}>Add follow-up</Button>
          <Button onClick={startVisit} loading={start.pending || newVisit.pending}>Start visit</Button>
        </div>
      </div>

      <dl className="mb-4 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-4 sm:divide-y-0">
        <Stat l="Upcoming appointment" v={upcoming ? `${upcoming.date === TODAY ? "Today" : fmtDate(upcoming.date)} · ${fmtTime(upcoming.time)}` : "None"} />
        <Stat l="Last visit" v={lastVisit ? `${fmtDate(lastVisit.date)} · ${lastVisit.type}` : "None"} />
        <Stat l="Visits" v={String(myVisits.filter((v) => v.status === "Completed").length)} />
        <Stat l="Open follow-ups" v={String(openFus.length)} />
      </dl>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2.5 text-[13px]">
        <Sparkles className="size-4 text-primary" aria-hidden /><span className="mr-1 font-medium">Ask EVI about {p.first}</span>
        <Button size="sm" variant="soft" onClick={() => ui.evi({ prompt: `Summarize ${p.first} ${p.last}'s recent visits` })}>Summarize visits</Button>
        <Button size="sm" variant="soft" onClick={() => ui.evi({ prep: { patientId: p.id, apptId: upcoming?.id } })}>Prepare next appointment</Button>
        <Button size="sm" variant="soft" onClick={() => ui.evi({ prompt: `Show follow-up history for ${p.first} ${p.last}` })}>Show follow-up history</Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>{["overview", "appointments", "visits", "documents", "follow-ups"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}</TabsList>

        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Panel>
              <PanelHeader title="Timeline" />
              {timeline.length === 0 ? <EmptyState title="No activity yet" text="Appointments and visits appear here." /> : (
                <ol className="p-4">
                  {timeline.map((t, i) => (
                    <li key={t.key} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < timeline.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden />}
                      <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 bg-white", t.date === TODAY ? "border-primary" : "border-slate-300")} aria-hidden />
                      <button onClick={t.onClick} className="-mt-1 flex-1 rounded-lg px-2 py-1 text-left hover:bg-cloud/60">
                        <p className="text-xs font-medium text-muted">{t.date === TODAY ? "Today" : fmtDate(t.date, true)}</p>
                        <p className="text-[14px] font-medium">{t.title} {t.a && <span className="ml-1 align-middle"><StatusBadge status={t.a.status} /></span>}{"live" in t && t.live && <Badge tone="blue" className="ml-1">In progress</Badge>}</p>
                        <p className="text-[13px] text-muted">{t.sub}</p>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <div className="space-y-5">
              <Panel><PanelHeader title="Contact" />
                <dl className="grid grid-cols-[88px_1fr] gap-y-2 p-4 text-[13px]">
                  <dt className="text-muted">Phone</dt><dd>{p.phone}</dd><dt className="text-muted">Email</dt><dd className="break-all">{p.email}</dd>
                  <dt className="text-muted">Address</dt><dd>{p.address ?? "—"}</dd><dt className="text-muted">Emergency</dt><dd>{p.emergency || "—"}</dd><dt className="text-muted">Provider</dt><dd>{prov(p.providerId ?? "") || "—"}</dd></dl></Panel>
              <Panel><PanelHeader title="Follow-up status" />
                {openFus.length === 0 ? <p className="p-4 text-[13px] text-muted">No open follow-ups.</p> : <ul className="divide-y divide-line">{openFus.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]"><span><span className="font-medium">{f.type}</span><br /><span className="text-xs text-muted">Due {fmtDate(f.due)}</span></span>{f.due < TODAY && <Badge tone="red">Overdue</Badge>}</li>))}</ul>}</Panel>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <Panel>{myAppts.length === 0 ? <EmptyState title="No appointments" text="Schedule the first appointment for this patient." action={<Button onClick={() => ui.newAppt({ patientId: p.id })}>New appointment</Button>} /> : (
            <ul className="divide-y divide-line">{myAppts.map((a) => (
              <li key={a.id}><button onClick={() => ui.openAppt(a.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-cloud/50">
                <span className="w-28 text-[13px] font-medium">{a.date === TODAY ? "Today" : fmtDate(a.date, true)}<br /><span className="font-normal text-muted">{fmtTime(a.time)}</span></span>
                <span className="flex-1 text-[13px]">{refs?.services.find((s) => s.id === a.serviceId)?.name}<br /><span className="text-muted">{prov(a.providerId)}</span></span><StatusBadge status={a.status} /></button></li>))}</ul>)}</Panel>
        </TabsContent>

        <TabsContent value="visits">
          <Panel>{myVisits.length === 0 ? <EmptyState title="No visits yet" text="Start a visit to begin documentation." /> : (
            <ul className="divide-y divide-line">{myVisits.map((v) => (
              <li key={v.id}><Link href={`/visits/${v.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-cloud/50">
                <span className="w-28 text-[13px] font-medium">{v.date === TODAY ? "Today" : fmtDate(v.date, true)}</span>
                <span className="flex-1 text-[13px]">{v.type}<br /><span className="text-muted">{prov(v.providerId)} · {v.reason || "No reason recorded"}</span></span>
                <Badge tone={v.status === "Completed" ? "mint" : "blue"}>{v.status}</Badge></Link></li>))}</ul>)}</Panel>
        </TabsContent>

        <TabsContent value="documents">
          <Panel>
            <PanelHeader title="Documents and forms" action={<Button size="sm" variant="secondary" onClick={() => toast.success("Upload dialog would open here")}><Upload className="size-4" />Upload</Button>} />
            {docs.length === 0 ? <EmptyState title="No documents" text="Signed forms and uploaded files appear here." /> : (
              <table className="w-full"><thead className="border-b border-line bg-cloud/50"><tr><Th>Document</Th><Th>Type</Th><Th>Visit</Th><Th>Status</Th><Th /></tr></thead>
                <tbody className="divide-y divide-line">{docs.map((d) => (
                  <tr key={d.id}><Td><span className="flex items-center gap-2"><FileText className="size-4 text-muted" />{d.name}</span></Td><Td>{d.kind}</Td><Td>{fmtDate(d.date)}</Td>
                    <Td><Badge tone={d.signed ? "mint" : "peach"}>{d.signed ? "Signed" : "Pending"}</Badge></Td>
                    <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setDelDoc({ visitId: d.visitId, formId: d.id, name: d.name })}>Delete</Button></Td></tr>))}</tbody></table>)}
          </Panel>
        </TabsContent>

        <TabsContent value="follow-ups">
          <Panel>{myFus.length === 0 ? <EmptyState title="No follow-ups" text="Add a follow-up to track this patient's next steps." action={<Button onClick={() => ui.newFollowUp({ patientId: p.id })}>Add follow-up</Button>} /> : (
            <ul className="divide-y divide-line">{myFus.map((f) => (
              <li key={f.id} className="flex items-center gap-4 px-4 py-3 text-[13px]"><span className="flex-1"><span className="font-medium">{f.type}</span><br /><span className="text-muted">Due {fmtDate(f.due, true)} · {f.assignee}</span></span>
                <Badge tone={f.status === "Completed" ? "mint" : f.due < TODAY ? "red" : "neutral"}>{f.status === "Open" && f.due < TODAY ? "Overdue" : f.status}</Badge>
                {f.status === "Open" && <Button size="sm" variant="secondary" onClick={() => complete.run(f.id)}>Complete</Button>}</li>))}</ul>)}</Panel>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={!!delDoc} onOpenChange={(o) => !o && setDelDoc(null)} title="Delete document?" danger loading={updateVisit.pending}
        description={<>“{delDoc?.name}” will be permanently removed from this patient&apos;s record. This can&apos;t be undone.</>} cancelLabel="Keep document" confirmLabel="Delete document"
        onConfirm={async () => { const v = visits!.find((x) => x.id === delDoc!.visitId)!; await updateVisit.run(v.id, { forms: v.forms.filter((x) => x.id !== delDoc!.formId) }); setDelDoc(null); }} />
    </>
  );
}

const Stat = ({ l, v }: { l: string; v: string }) => <div className="px-4 py-3"><dt className="text-xs text-muted">{l}</dt><dd className="mt-0.5 text-[14px] font-medium">{v}</dd></div>;
