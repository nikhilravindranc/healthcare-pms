"use client";
import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge, Button, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Panel, PanelHeader, Select, SkeletonRows, Td, Textarea, Th } from "@/components/ui";
import { useAction, useRefs } from "@/lib/hooks";
import { api } from "@/lib/db";
import { cn } from "@/lib/utils";

const NAV = [
  ["providers", "Providers"], ["services", "Services & treatments"], ["locations", "Locations"], ["rooms", "Rooms & resources"],
  ["forms", "Forms & documents"], ["users", "Users & permissions"], ["settings", "Practice settings"], ["integrations", "Integrations"],
] as const;

export default function PracticePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  if (!NAV.some(([k]) => k === section)) notFound();
  const title = NAV.find(([k]) => k === section)![1];
  return (
    <>
      <PageHeader title={title} subtitle="Practice configuration" />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Practice configuration" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map(([k, l]) => (
            <Link key={k} href={`/practice/${k}`} aria-current={k === section ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] font-medium", k === section ? "bg-active text-primary" : "text-slate-600 hover:bg-cloud")}>{l}</Link>
          ))}
        </nav>
        <div className="min-w-0">
          {section === "providers" && <Providers />}{section === "services" && <Services />}{section === "locations" && <Locations />}{section === "rooms" && <Rooms />}
          {section === "forms" && <Forms />}{section === "users" && <Users />}{section === "settings" && <SettingsSection />}{section === "integrations" && <Integrations />}
        </div>
      </div>
    </>
  );
}

/* ------- generic add dialog (Zod-validated) ------- */
interface FieldDef { key: string; label: string; type?: "text" | "number" | "select"; options?: string[]; placeholder?: string }
function AddDialog({ open, onClose, title, fields, kind, label }: { open: boolean; onClose: () => void; title: string; fields: FieldDef[]; kind: Parameters<typeof api.addConfig>[0]; label: string }) {
  const add = useAction(api.addConfig, `${label} added`);
  const [v, setV] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const schema = z.object(Object.fromEntries(fields.map((f) => [f.key, z.string().min(1, `${f.label} is required`)])));
  const submit = async () => {
    const r = schema.safeParse(Object.fromEntries(fields.map((f) => [f.key, v[f.key] ?? (f.options?.[0] ?? "")])));
    if (!r.success) return setErrs(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
    await add.run(kind, r.data); setV({}); setErrs({}); onClose();
  };
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={add.pending} onClick={submit}>Add {label.toLowerCase()}</Button></>}>
      <div className="space-y-4">{fields.map((f) => (
        <Field key={f.key} label={f.label} required error={errs[f.key]}>
          {f.type === "select" ? <Select value={v[f.key] ?? f.options![0]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>{f.options!.map((o) => <option key={o}>{o}</option>)}</Select>
            : <Input type={f.type ?? "text"} placeholder={f.placeholder} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />}
        </Field>))}</div>
    </Modal>
  );
}

function TableShell({ title, action, children, loading, empty }: { title: string; action?: React.ReactNode; children: React.ReactNode; loading?: boolean; empty?: boolean }) {
  return <Panel><PanelHeader title={title} action={action} />{loading ? <SkeletonRows rows={4} /> : empty ? <EmptyState title="Nothing configured yet" /> : <div className="overflow-x-auto">{children}</div>}</Panel>;
}
const status = (s: string) => <Badge tone={s === "Active" || s === "Open" ? "mint" : s === "Invited" ? "peach" : "neutral"}>{s}</Badge>;

function Providers() {
  const { data, isLoading } = useRefs(); const [open, setOpen] = useState(false);
  return <><TableShell title="Providers" loading={isLoading} action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />New provider</Button>}>
    <table className="w-full min-w-[760px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Provider</Th><Th>Specialty</Th><Th>Availability</Th><Th>Services</Th><Th>Locations</Th><Th>Status</Th></tr></thead>
      <tbody className="divide-y divide-line">{data?.providers.map((p) => <tr key={p.id}><Td className="font-medium">{p.name}</Td><Td>{p.specialty}</Td><Td>{p.hours}</Td><Td>{p.serviceIds.length ? `${p.serviceIds.length} services` : "None assigned"}</Td><Td>{p.locationIds.map((l) => data.locations.find((x) => x.id === l)?.name.replace("Brightwell ", "")).join(", ")}</Td><Td>{status(p.status)}</Td></tr>)}</tbody></table></TableShell>
    <AddDialog open={open} onClose={() => setOpen(false)} title="New provider" kind="providers" label="Provider" fields={[{ key: "name", label: "Provider name", placeholder: "Dr. First Last" }, { key: "specialty", label: "Specialty" }]} /></>;
}
function Services() {
  const { data, isLoading } = useRefs(); const [open, setOpen] = useState(false);
  return <><TableShell title="Services & treatments" loading={isLoading} action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />New service</Button>}>
    <table className="w-full min-w-[760px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Service</Th><Th>Category</Th><Th>Duration</Th><Th>Provider availability</Th><Th>Location</Th><Th>Status</Th></tr></thead>
      <tbody className="divide-y divide-line">{data?.services.map((s) => <tr key={s.id}><Td className="font-medium">{s.name}</Td><Td>{s.category}</Td><Td>{s.duration} min</Td><Td>{s.providerIds.map((p) => data.providers.find((x) => x.id === p)?.short).join(", ") || "Unassigned"}</Td><Td>{s.locationIds.map((l) => data.locations.find((x) => x.id === l)?.name.replace("Brightwell ", "")).join(", ")}</Td><Td>{status(s.status)}</Td></tr>)}</tbody></table></TableShell>
    <AddDialog open={open} onClose={() => setOpen(false)} title="New service" kind="services" label="Service" fields={[{ key: "name", label: "Service name" }, { key: "category", label: "Category", type: "select", options: ["Consultation", "Aesthetics", "Dermatology", "Physiotherapy", "Dental", "Review"] }, { key: "duration", label: "Duration (minutes)", type: "number", placeholder: "30" }]} /></>;
}
function Locations() {
  const { data, isLoading } = useRefs(); const [open, setOpen] = useState(false);
  return <><TableShell title="Locations" loading={isLoading} action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />New location</Button>}>
    <table className="w-full min-w-[640px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Location</Th><Th>Address</Th><Th>Phone</Th><Th>Status</Th></tr></thead>
      <tbody className="divide-y divide-line">{data?.locations.map((l) => <tr key={l.id}><Td className="font-medium">{l.name}</Td><Td>{l.address}</Td><Td>{l.phone}</Td><Td>{status(l.status)}</Td></tr>)}</tbody></table></TableShell>
    <AddDialog open={open} onClose={() => setOpen(false)} title="New location" kind="locations" label="Location" fields={[{ key: "name", label: "Location name" }, { key: "address", label: "Address" }, { key: "phone", label: "Phone" }]} /></>;
}
function Rooms() {
  const { data, isLoading } = useRefs(); const [open, setOpen] = useState(false);
  return <><TableShell title="Rooms & resources" loading={isLoading} action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />New room</Button>}>
    <table className="w-full min-w-[640px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Room</Th><Th>Location</Th><Th>Resource type</Th><Th>Availability</Th></tr></thead>
      <tbody className="divide-y divide-line">{data?.rooms.map((r) => <tr key={r.id}><Td className="font-medium">{r.name}</Td><Td>{data.locations.find((l) => l.id === r.locationId)?.name}</Td><Td>{r.type}</Td><Td>{r.availability}</Td></tr>)}</tbody></table></TableShell>
    <AddDialog open={open} onClose={() => setOpen(false)} title="New room" kind="rooms" label="Room" fields={[{ key: "name", label: "Room name" }, { key: "locationId", label: "Location ID", type: "select", options: ["dt", "ws"] }, { key: "type", label: "Resource type", type: "select", options: ["Consultation room", "Treatment suite", "Therapy space", "Equipment"] }]} /></>;
}

function Forms() {
  const [list, setList] = useState([
    { n: "Treatment consent", t: "Consent forms", u: "Aesthetics" }, { n: "Photo release", t: "Consent forms", u: "All services" },
    { n: "Medical history", t: "Clinical forms", u: "New patients" }, { n: "Physiotherapy intake", t: "Clinical forms", u: "Physiotherapy" }, { n: "Skin assessment", t: "Clinical forms", u: "Dermatology" }, { n: "Patient registration", t: "Form templates", u: "New patients" },
  ]);
  const [name, setName] = useState(""); const [open, setOpen] = useState(false); const [err, setErr] = useState("");
  return <>
    {["Form templates", "Consent forms", "Clinical forms"].map((g) => (
      <Panel key={g} className="mb-5"><PanelHeader title={g} action={g === "Form templates" && <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />New template</Button>} />
        <ul className="divide-y divide-line">{list.filter((x) => x.t === g).map((x) => <li key={x.n} className="flex items-center justify-between px-4 py-3 text-[13px]"><span className="font-medium">{x.n}</span><span className="text-muted">{x.u}</span></li>)}
          {list.filter((x) => x.t === g).length === 0 && <li className="px-4 py-3 text-[13px] text-muted">No templates.</li>}</ul></Panel>))}
    <Modal open={open} onOpenChange={setOpen} title="New form template" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { if (!name.trim()) return setErr("Template name is required"); setList([...list, { n: name, t: "Form templates", u: "All services" }]); setName(""); setOpen(false); toast.success("Template added"); }}>Add template</Button></>}>
      <Field label="Template name" required error={err}><Input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} /></Field></Modal></>;
}

function Users() {
  const { data, isLoading } = useRefs(); const [open, setOpen] = useState(false);
  return <><TableShell title="Users & permissions" loading={isLoading} action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />Invite user</Button>}>
    <table className="w-full min-w-[640px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>User</Th><Th>Role</Th><Th>Status</Th></tr></thead>
      <tbody className="divide-y divide-line">{data?.users.map((u) => <tr key={u.id}><Td><span className="font-medium">{u.name}</span><span className="block text-xs text-muted">{u.email}</span></Td><Td>{u.role}</Td><Td>{status(u.status)}</Td></tr>)}</tbody></table></TableShell>
    <p className="mt-3 text-xs text-muted">Roles: Owner, Practice manager, Provider, Front desk, Staff.</p>
    <AddDialog open={open} onClose={() => setOpen(false)} title="Invite user" kind="users" label="User" fields={[{ key: "name", label: "Full name" }, { key: "email", label: "Email" }, { key: "role", label: "Role", type: "select", options: ["Owner", "Practice manager", "Provider", "Front desk", "Staff"] }]} /></>;
}

function Block({ t, children }: { t: string; children: React.ReactNode }) {
  return <Panel className="mb-5"><PanelHeader title={t} action={<Button size="sm" variant="secondary" onClick={() => toast.success(`${t} saved`)}>Save</Button>} /><div className="space-y-4 p-4">{children}</div></Panel>;
}

function SettingsSection() {
  const [s, setS] = useState({ reminders: true, confirm: true, waitAlert: true, daily: false, mfa: true, autoLogout: true, portal: false });
  const flip = (k: keyof typeof s) => (v: boolean) => setS({ ...s, [k]: v });
  return <>
    <Block t="Practice details"><div className="grid gap-4 sm:grid-cols-2"><Field label="Practice name"><Input defaultValue="Brightwell Clinic" /></Field><Field label="Phone"><Input defaultValue="(415) 555-0142" /></Field><Field label="Time zone"><Select defaultValue="America/Los_Angeles"><option>America/Los_Angeles</option><option>America/New_York</option></Select></Field></div></Block>
    <Block t="Appointment settings"><div className="grid gap-4 sm:grid-cols-2"><Field label="Default duration"><Select defaultValue="30"><option value="20">20 min</option><option value="30">30 min</option><option value="45">45 min</option></Select></Field><Field label="Booking window"><Select defaultValue="90"><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option></Select></Field></div>
      <Checkbox checked={s.confirm} onChange={flip("confirm")} label="Ask patients to confirm appointments" /></Block>
    <Block t="Notifications"><Checkbox checked={s.reminders} onChange={flip("reminders")} label="Send appointment reminders" /><Checkbox checked={s.waitAlert} onChange={flip("waitAlert")} label="Alert when a patient waits more than 15 minutes" /><Checkbox checked={s.daily} onChange={flip("daily")} label="Email a daily practice summary" /></Block>
    <Block t="Working hours"><div className="grid gap-4 sm:grid-cols-2"><Field label="Opens"><Input type="time" defaultValue="08:30" /></Field><Field label="Closes"><Input type="time" defaultValue="17:30" /></Field></div></Block>
    <Block t="Patient settings"><Checkbox checked={s.portal} onChange={flip("portal")} label="Allow patients to request appointments online" /><Field label="Patient ID prefix"><Input defaultValue="P-" className="max-w-32" /></Field></Block>
    <Block t="Security"><Checkbox checked={s.mfa} onChange={flip("mfa")} label="Require two-step verification for all staff" /><Checkbox checked={s.autoLogout} onChange={flip("autoLogout")} label="Sign out after 30 minutes of inactivity" /><Field label="Internal note"><Textarea placeholder="Notes for administrators" /></Field></Block></>;
}

function Integrations() {
  const [apps, setApps] = useState([
    { n: "Campaigns", d: "Patient outreach and recall messaging", on: true }, { n: "Billing", d: "Invoices and payments", on: true },
    { n: "Messaging", d: "Two-way patient text messages", on: false }, { n: "Telehealth", d: "Video visits", on: false },
  ]);
  return <div className="grid gap-4 sm:grid-cols-2">{apps.map((a) => (
    <Panel key={a.n} className="flex items-start justify-between gap-3 p-4"><div><p className="font-medium">{a.n}</p><p className="text-[13px] text-muted">{a.d}</p><div className="mt-2">{a.on ? <Badge tone="mint">Connected</Badge> : <Badge>Not connected</Badge>}</div></div>
      <Button size="sm" variant="secondary" onClick={() => { setApps(apps.map((x) => x.n === a.n ? { ...x, on: !x.on } : x)); toast.success(a.on ? `${a.n} disconnected` : `${a.n} connected`); }}>{a.on ? "Disconnect" : "Connect"}</Button></Panel>))}</div>;
}
