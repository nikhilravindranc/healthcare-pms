"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, CheckCircle2, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Field, Input, Panel, PanelHeader, Select, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { useAction, useAppointments, useFollowUps, useRefs, useVisits } from "@/lib/hooks";
import { api, fmtDate, getPatient, pname, TODAY } from "@/lib/db";
import type { TreatmentLine, Visit } from "@/lib/types";
import { PlotSummary } from "@/components/app/plot";

export default function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: visits, isLoading } = useVisits();
  const { data: refs } = useRefs();
  const { data: appts } = useAppointments();
  const { data: fus } = useFollowUps();
  const ui = useUI();
  const router = useRouter();
  const update = useAction(api.updateVisit);
  const complete = useAction(api.completeVisit, "Visit completed");
  const [confirm, setConfirm] = useState(false);

  const v = visits?.find((x) => x.id === id);
  const [draft, setDraft] = useState<Visit | null>(null);
  useEffect(() => { if (v && (!draft || draft.id !== v.id)) setDraft(v); }, [v, draft]);

  if (isLoading || (v && !draft)) return <div className="space-y-4"><Skeleton className="h-9 w-72" /><Skeleton className="h-10 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (!v || !draft) return <EmptyState title="Visit not found" action={<Link href="/visits"><Button variant="secondary">Back to visits</Button></Link>} />;

  const p = getPatient(v.patientId)!;
  const provider = refs?.providers.find((x) => x.id === v.providerId);
  const locked = v.status === "Completed";
  const prev = (visits ?? []).filter((x) => x.patientId === v.patientId && x.id !== v.id && x.status === "Completed" && x.date <= v.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const appt = appts?.find((a) => a.id === v.apptId);
  const save = (patch: Partial<Visit>) => { setDraft((d) => ({ ...d!, ...patch })); return update.run(v.id, patch); };
  const myFu = fus?.filter((f) => f.patientId === v.patientId && f.status === "Open") ?? [];

  return (
    <>
      <nav className="mb-3 text-[13px] text-muted"><Link href="/visits" className="hover:text-primary">Visits</Link> / {pname(v.patientId)}</nav>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="text-[26px] font-semibold leading-tight tracking-tight">{v.type}</h1><Badge tone={locked ? "mint" : "blue"}>{v.status}</Badge></div>
          <p className="mt-1 text-sm text-muted"><Link href={`/patients/${p.id}`} className="font-medium text-ink hover:text-primary hover:underline">{p.first} {p.last}</Link> · {p.id} · {v.date === TODAY ? "Today" : fmtDate(v.date, true)} · {provider?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => ui.evi({ prep: { patientId: p.id, apptId: v.apptId } })}><Sparkles className="size-4 text-primary" />Prepare this visit</Button>
          {!locked && <Button onClick={() => setConfirm(true)}><CheckCircle2 className="size-4" />Complete visit</Button>}
          {locked && <Button variant="secondary" onClick={() => router.push(`/patients/${p.id}`)}>Open patient</Button>}
        </div>
      </div>
      {locked && <div className="mb-4"><Alert tone="success" title="This visit is completed">Documentation is read-only.</Alert></div>}

      <Tabs defaultValue="summary">
        <TabsList>{["Summary", "Notes", "Treatment", "Forms", "Photos", "Follow-up"].map((t) => <TabsTrigger key={t} value={t.toLowerCase()}>{t}</TabsTrigger>)}</TabsList>

        <TabsContent value="summary">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel><PanelHeader title="Reason for visit" /><div className="p-4">
              <Textarea disabled={locked} aria-label="Reason for visit" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} onBlur={() => draft.reason !== v.reason && save({ reason: draft.reason })} placeholder="Why is the patient here today?" />
              {appt && <p className="mt-2 text-xs text-muted">Booked appointment: {refs?.services.find((s) => s.id === appt.serviceId)?.name}</p>}</div></Panel>
            <Panel><PanelHeader title="Previous visit" action={prev && <Link href={`/visits/${prev.id}`} className="text-[13px] font-medium text-primary hover:underline">Open</Link>} />
              {prev ? <div className="space-y-1 p-4 text-[13px]"><p className="font-medium">{fmtDate(prev.date, true)} · {prev.type}</p><p className="text-muted">{prev.reason}</p><p>{prev.notes.plan}</p></div> : <EmptyState title="No previous visit" />}</Panel>
            <Panel><PanelHeader title="Relevant history" />
              <ul className="divide-y divide-line">{(visits ?? []).filter((x) => x.patientId === p.id && x.id !== v.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((x) => (
                <li key={x.id} className="px-4 py-2.5 text-[13px]"><span className="font-medium">{fmtDate(x.date)}</span> · {x.type}<span className="block text-muted">{x.reason}</span></li>))}
                {(visits ?? []).filter((x) => x.patientId === p.id && x.id !== v.id).length === 0 && <li className="px-4 py-3 text-[13px] text-muted">No previous history on file.</li>}</ul></Panel>
            <Panel><PanelHeader title="Current treatment" action={<Button size="sm" variant="secondary" onClick={() => router.push(`/visits/${v.id}/plotting`)}>Injection plotting</Button>} />
              {draft.treatments.length ? <ul className="divide-y divide-line">{draft.treatments.map((t) => <li key={t.id} className="px-4 py-2.5 text-[13px]"><span className="font-medium">{t.product}</span> · {t.units} units<span className="block text-muted">{t.area}</span></li>)}</ul> : <p className="p-4 text-[13px] text-muted">No treatment documented yet.</p>}</Panel>
            <Panel className="lg:col-span-2"><PanelHeader title="Follow-up" />
              <div className="p-4 text-[13px]">{draft.followUpRecommended ? <p><span className="text-muted">Recommended:</span> {draft.followUpRecommended}</p> : <p className="text-muted">No follow-up recommended yet.</p>}
                {myFu.length > 0 && <p className="mt-1"><span className="text-muted">Open:</span> {myFu.map((f) => `${f.type} (${fmtDate(f.due)})`).join(", ")}</p>}</div></Panel>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <Panel><PanelHeader title="Clinical notes" sub={locked ? "Read-only" : "Saved automatically when you leave a field"} />
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {([["subjective", "Subjective: history and patient report"], ["objective", "Objective: findings"], ["assessment", "Assessment"], ["plan", "Plan and instructions"]] as const).map(([k, l]) => (
                <Field key={k} label={l}><Textarea disabled={locked} className="min-h-28" value={draft.notes[k]} onChange={(e) => setDraft({ ...draft, notes: { ...draft.notes, [k]: e.target.value } })}
                  onBlur={() => draft.notes[k] !== v.notes[k] && save({ notes: draft.notes }).then(() => toast.success("Note saved"))} /></Field>
              ))}
            </div></Panel>
        </TabsContent>

        <TabsContent value="treatment"><TreatmentTab v={draft} locked={locked} save={save} /></TabsContent>

        <TabsContent value="forms">
          <Panel><PanelHeader title="Forms and documents" action={!locked && (
            <Select sm className="w-44" aria-label="Add form" value="" onChange={(e) => { if (!e.target.value) return; const [kind, name] = e.target.value.split("|"); save({ forms: [...draft.forms, { id: `f${Date.now()}`, name, kind: kind as never, signed: false }] }); toast.success(`${name} added`); }}>
              <option value="">Add form…</option><option value="Consent|Treatment consent">Treatment consent</option><option value="Clinical form|Medical history form">Medical history form</option><option value="Document|Photo release">Photo release</option></Select>)} />
            {draft.forms.length === 0 ? <EmptyState title="No forms attached" text="Add a consent or clinical form for this visit." /> : (
              <ul className="divide-y divide-line">{draft.forms.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-[13px]"><FileText className="size-4 text-muted" /><span className="flex-1"><span className="font-medium">{f.name}</span><br /><span className="text-muted">{f.kind}</span></span>
                  <Badge tone={f.signed ? "mint" : "peach"}>{f.signed ? "Signed" : "Awaiting signature"}</Badge>
                  {!f.signed && !locked && <Button size="sm" variant="secondary" onClick={() => save({ forms: draft.forms.map((x) => x.id === f.id ? { ...x, signed: true } : x) }).then(() => toast.success("Marked as signed"))}>Mark as signed</Button>}</li>))}</ul>)}</Panel>
        </TabsContent>

        <TabsContent value="photos">
          <div className="grid gap-5 md:grid-cols-3">
            {(["Before", "During", "After"] as const).map((stage) => {
              const list = draft.photos.filter((x) => x.stage === stage);
              return (
                <Panel key={stage}><PanelHeader title={stage} action={!locked && <Button size="sm" variant="secondary" onClick={() => { save({ photos: [...draft.photos, { id: `ph${Date.now()}`, stage, label: ["Front view", "Left profile", "Right profile"][list.length % 3] }] }); toast.success("Photo added"); }}><Camera className="size-4" />Add</Button>} />
                  {list.length === 0 ? <p className="p-4 text-[13px] text-muted">No {stage.toLowerCase()} photos.</p> : (
                    <ul className="grid grid-cols-2 gap-3 p-4">{list.map((ph) => <li key={ph.id}><div className="grid aspect-[4/5] place-items-center rounded-lg bg-cloud text-muted"><Camera className="size-6" aria-hidden /></div><p className="mt-1 text-xs text-muted">{ph.label}</p></li>)}</ul>)}</Panel>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="follow-up">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel><PanelHeader title="Instructions and recommendation" /><div className="space-y-4 p-4">
              <Field label="Patient instructions"><Textarea disabled={locked} value={draft.followUpInstructions} onChange={(e) => setDraft({ ...draft, followUpInstructions: e.target.value })} onBlur={() => draft.followUpInstructions !== v.followUpInstructions && save({ followUpInstructions: draft.followUpInstructions })} /></Field>
              <Field label="Recommended follow-up"><Input disabled={locked} placeholder="e.g. Post-treatment review in 2 weeks" value={draft.followUpRecommended} onChange={(e) => setDraft({ ...draft, followUpRecommended: e.target.value })} onBlur={() => draft.followUpRecommended !== v.followUpRecommended && save({ followUpRecommended: draft.followUpRecommended })} /></Field></div></Panel>
            <Panel><PanelHeader title="Next appointment" />
              <div className="space-y-3 p-4 text-[13px]">
                <p className="text-muted">{(appts ?? []).some((a) => a.patientId === p.id && a.date > v.date && !["cancelled", "no_show"].includes(a.status)) ? "A future appointment is already scheduled." : "No next appointment scheduled."}</p>
                <div className="flex flex-wrap gap-2"><Button onClick={() => ui.newAppt({ patientId: p.id, providerId: v.providerId })}>Schedule next appointment</Button><Button variant="secondary" onClick={() => ui.newFollowUp({ patientId: p.id, visitId: v.id })}>Add follow-up</Button></div>
                {myFu.length > 0 && <ul className="mt-2 space-y-1">{myFu.map((f) => <li key={f.id}>{f.type} · due {fmtDate(f.due)}</li>)}</ul>}</div></Panel>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Complete this visit?" description={`Documentation for ${pname(v.patientId)} will become read-only. A follow-up will be created if one is recommended.`}
        cancelLabel="Keep editing" confirmLabel="Complete visit" loading={complete.pending}
        onConfirm={async () => { await complete.run(v.id); setConfirm(false); }} />
    </>
  );
}

function TreatmentTab({ v, locked, save }: { v: Visit; locked: boolean; save: (p: Partial<Visit>) => Promise<unknown> }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [t, setT] = useState({ service: "Injectable treatment", area: "", product: "", units: "", notes: "" });
  const [err, setErr] = useState("");
  const { data: refs } = useRefs();
  const add = async () => {
    if (!t.area.trim() || !t.product.trim()) return setErr("Treatment area and product are required");
    const line: TreatmentLine = { id: `t${Date.now()}`, service: t.service, area: t.area, product: t.product, units: Number(t.units) || 0, notes: t.notes };
    await save({ treatments: [...v.treatments, line] });
    toast.success("Treatment added"); setAdding(false); setT({ service: "Injectable treatment", area: "", product: "", units: "", notes: "" }); setErr("");
  };
  return (
    <div className="space-y-5">
      <Panel><PanelHeader title="Treatments performed" action={!locked && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" />Add treatment</Button>} />
        {v.treatments.length === 0 && !adding ? <EmptyState title="No treatment documented" text="Add services, areas, products and units." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]"><thead className="border-b border-line bg-cloud/50 text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5 font-medium">Service</th><th className="px-4 py-2.5 font-medium">Area</th><th className="px-4 py-2.5 font-medium">Product</th><th className="px-4 py-2.5 font-medium">Units</th><th className="px-4 py-2.5 font-medium">Notes</th><th /></tr></thead>
            <tbody className="divide-y divide-line">{v.treatments.map((x) => (
              <tr key={x.id}><td className="px-4 py-3">{x.service}</td><td className="px-4 py-3">{x.area}</td><td className="px-4 py-3">{x.product}</td><td className="px-4 py-3">{x.units}</td><td className="px-4 py-3 text-muted">{x.notes || "—"}</td>
                <td className="px-4 py-3 text-right">{!locked && <button aria-label="Remove treatment" className="rounded p-1.5 text-muted hover:bg-cloud hover:text-danger" onClick={() => save({ treatments: v.treatments.filter((y) => y.id !== x.id) })}><Trash2 className="size-4" /></button>}</td></tr>))}</tbody></table></div>)}
        {adding && (
          <div className="anim-fade space-y-3 border-t border-line bg-cloud/40 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Service"><Select value={t.service} onChange={(e) => setT({ ...t, service: e.target.value })}>{refs?.services.map((s) => <option key={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="Treatment area" required><Input value={t.area} onChange={(e) => setT({ ...t, area: e.target.value })} placeholder="e.g. Forehead" /></Field>
              <Field label="Product" required><Input value={t.product} onChange={(e) => setT({ ...t, product: e.target.value })} placeholder="e.g. Botulinum toxin A" /></Field>
              <Field label="Units"><Input type="number" min={0} step="0.1" value={t.units} onChange={(e) => setT({ ...t, units: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><Input value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} /></Field>
            {err && <p role="alert" className="text-xs text-danger">{err}</p>}
            <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button size="sm" onClick={add}>Add treatment</Button></div>
          </div>)}
      </Panel>
      <Panel><PanelHeader title="Injection plotting" sub="Document injection points on the anatomical map" action={<Button size="sm" variant="secondary" onClick={() => router.push(`/visits/${v.id}/plotting`)}>{locked ? "View plot" : "Open injection plotting"}</Button>} />
        <PlotSummary visit={v} /></Panel>
    </div>
  );
}
