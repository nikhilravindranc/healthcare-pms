"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthShell, AuthTitle } from "@/components/auth/shell";
import { Button, Field, Input, Select } from "@/components/ui";
import { practiceDetailsSchema, practiceSchema } from "@/lib/schemas";
import { auth, useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { z } from "zod";

const STEPS = ["Your account", "Your practice", "Practice details", "You're ready"];
const TYPES = ["Medical clinic", "Dental", "Medical aesthetics", "Dermatology", "Physiotherapy", "Wellness", "Other specialty"];

export default function SetupPage() {
  const router = useRouter();
  const session = useSession();
  const [step, setStep] = useState(0);
  const [practice, setPractice] = useState<z.infer<typeof practiceSchema> | null>(null);
  const [busy, setBusy] = useState(false);

  const a = useForm<z.infer<typeof practiceSchema>>({ resolver: zodResolver(practiceSchema), defaultValues: { name: "", type: "" } });
  const b = useForm<z.infer<typeof practiceDetailsSchema>>({ resolver: zodResolver(practiceDetailsSchema), defaultValues: { location: "", phone: "", timezone: "America/Los_Angeles", owner: session?.name ?? "", providers: "1" } });
  const type = a.watch("type");

  return (
    <AuthShell wide>
      <ol className="mb-8 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", i < step ? "bg-primary text-white" : i === step ? "border-2 border-primary text-primary" : "border border-line text-muted")}>
              {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("hidden text-xs font-medium sm:block", i === step ? "text-ink" : "text-muted")}>{s}</span>
            {i < 3 && <span className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-line")} />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="max-w-[400px]">
          <AuthTitle title="Your account is created" text="Next, tell us about your practice. This takes about a minute." />
          <div className="mb-5 rounded-lg border border-line bg-cloud/60 px-4 py-3 text-sm">
            <p className="font-medium">{session?.name ?? "New account"}</p><p className="text-muted">{session?.email}</p>
          </div>
          <Button className="w-full" onClick={() => setStep(1)}>Continue</Button>
        </div>
      )}

      {step === 1 && (
        <form noValidate className="max-w-[460px] space-y-5" onSubmit={a.handleSubmit((v) => { setPractice(v); setStep(2); })}>
          <AuthTitle title="Tell us about your practice" />
          <Field label="Practice name" error={a.formState.errors.name?.message}><Input placeholder="e.g. Brightwell Clinic" {...a.register("name")} /></Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">Practice type</legend>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button type="button" key={t} aria-pressed={type === t} onClick={() => a.setValue("type", t, { shouldValidate: true })}
                  className={cn("rounded-lg border px-3 py-2.5 text-left text-sm transition-colors", type === t ? "border-primary bg-active text-primary" : "border-line hover:bg-cloud")}>{t}</button>
              ))}
            </div>
            {a.formState.errors.type && <p role="alert" className="mt-1.5 text-xs text-danger">{a.formState.errors.type.message}</p>}
          </fieldset>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setStep(0)}>Back</Button><Button type="submit" className="flex-1">Continue</Button></div>
        </form>
      )}

      {step === 2 && (
        <form noValidate className="max-w-[460px] space-y-4"
          onSubmit={b.handleSubmit(async () => { setBusy(true); await new Promise((r) => setTimeout(r, 900)); auth.setPractice(practice!.name); setBusy(false); setStep(3); })}>
          <AuthTitle title="Practice details" text={practice?.name} />
          <Field label="Location" error={b.formState.errors.location?.message}><Input placeholder="Street address, city" {...b.register("location")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" error={b.formState.errors.phone?.message}><Input type="tel" {...b.register("phone")} /></Field>
            <Field label="Time zone"><Select {...b.register("timezone")}>
              {["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Europe/London", "Asia/Kolkata"].map((z) => <option key={z}>{z}</option>)}
            </Select></Field>
          </div>
          <Field label="Primary provider / owner" error={b.formState.errors.owner?.message}><Input {...b.register("owner")} /></Field>
          <Field label="Number of providers"><Select {...b.register("providers")}>{["1", "2–3", "4–10", "11+"].map((n) => <option key={n}>{n}</option>)}</Select></Field>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button><Button type="submit" className="flex-1" loading={busy}>Continue</Button></div>
        </form>
      )}

      {step === 3 && (
        <div className="max-w-[400px]">
          <AuthTitle title="Your practice is ready" text={`${practice?.name ?? "Your practice"} is set up. You can add providers, services and locations any time from the Practice section.`} />
          <Button className="w-full" onClick={() => router.push("/welcome")}>Enter Practice</Button>
        </div>
      )}
    </AuthShell>
  );
}
