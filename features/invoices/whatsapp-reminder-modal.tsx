"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, MessageSquare, Phone, RefreshCw, Send, ShieldAlert, UserCheck } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { generatePendingPaymentBriefing, sendWhatsAppMessageViaBot } from "@/server/actions/whatsapp-reminders";
import type { ClientReminderDraft, WhatsAppReminderResult } from "@/server/actions/whatsapp-reminders";

export function WhatsAppReminderModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [targetPhone, setTargetPhone] = useState("9324290047");
  const [activeTab, setActiveTab] = useState<"owner" | "clients">("owner");
  const [data, setData] = useState<WhatsAppReminderResult | null>(null);

  async function generate(phone: string) {
    setLoading(true);
    setStatus(null);
    try {
      const result = await generatePendingPaymentBriefing(phone);
      if (result.success) setData(result);
      else setStatus({ type: "error", text: result.error || "Unable to generate payment alerts." });
    } catch {
      setStatus({ type: "error", text: "Unable to connect to the alert service." });
    } finally {
      setLoading(false);
    }
  }

  async function send(phone: string, message: string, id: string) {
    setSendingId(id);
    setStatus(null);
    try {
      const result = await sendWhatsAppMessageViaBot(phone, message);
      setStatus({ type: result.success ? "success" : "error", text: result.message });
    } catch {
      setStatus({ type: "error", text: "Unable to send via Meta WhatsApp API." });
    } finally {
      setSendingId(null);
    }
  }

  async function copy(id: string, message: string) {
    await navigator.clipboard.writeText(message);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function open() {
    setIsOpen(true);
    if (!data) void generate(targetPhone);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={open} className="inline-flex items-center gap-2 border-emerald-600/40 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
        <MessageSquare className="h-4 w-4" /> WhatsApp AI Alert
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-bold">WhatsApp Payment Alerts</h2>
                <p className="text-xs text-muted-foreground">Private owner briefing and separate client reminders, delivered via Meta WhatsApp Cloud API.</p>
              </div>
              <button type="button" aria-label="Close payment alerts" onClick={() => setIsOpen(false)} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Close</button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-2.5">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Owner WhatsApp:</span>
                <Input value={targetPhone} onChange={(event) => setTargetPhone(event.target.value)} className="h-7 w-36 font-mono text-xs" placeholder="9324290047" />
              </div>
              <div className="flex gap-1 text-xs">
                <button type="button" onClick={() => setTargetPhone("9324290047")} className="rounded bg-card px-2 py-0.5 hover:bg-muted">Testing</button>
                <button type="button" onClick={() => setTargetPhone("9820490779")} className="rounded bg-card px-2 py-0.5 hover:bg-muted">Owner</button>
              </div>
            </div>

            {data ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border p-2"><div className="text-muted-foreground">Outstanding</div><strong>{formatCurrency(data.totalUnpaid ?? 0)}</strong></div>
                <div className="rounded-lg border p-2"><div className="text-muted-foreground">Unpaid bills</div><strong>{data.totalCount ?? 0}</strong></div>
                <div className="rounded-lg border p-2"><div className="text-muted-foreground">Client drafts</div><strong>{data.clientMessages?.length ?? 0}</strong></div>
              </div>
            ) : null}

            {status ? <div className={`mt-3 flex gap-2 rounded-lg p-2 text-xs ${status.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-destructive/10 text-destructive"}`}><AlertCircle className="h-4 w-4 shrink-0" />{status.text}</div> : null}

            <div className="mt-3 flex items-center justify-between border-b">
              <div className="flex gap-3 text-xs font-semibold">
                <button type="button" onClick={() => setActiveTab("owner")} className={`border-b-2 px-2 py-2 ${activeTab === "owner" ? "border-emerald-600 text-emerald-700" : "border-transparent text-muted-foreground"}`}><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />Owner briefing</button>
                <button type="button" onClick={() => setActiveTab("clients")} className={`border-b-2 px-2 py-2 ${activeTab === "clients" ? "border-emerald-600 text-emerald-700" : "border-transparent text-muted-foreground"}`}><UserCheck className="mr-1 inline h-3.5 w-3.5" />Client drafts ({data?.clientMessages?.length ?? 0})</button>
              </div>
              <button type="button" onClick={() => void generate(targetPhone)} disabled={loading} className="flex items-center gap-1 text-xs text-primary disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />Re-generate</button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              {loading ? <div className="flex h-52 items-center justify-center gap-2 rounded-lg border text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Generating private payment alerts...</div> : null}
              {!loading && activeTab === "owner" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Delivery recipient: {targetPhone}</p>
                  <div className="rounded-lg border bg-muted/20 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{data?.ownerBriefing || "No owner briefing generated."}</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" disabled={!data?.ownerBriefing} onClick={() => data?.ownerBriefing && void copy("owner", data.ownerBriefing)} className="h-8 text-xs">{copiedId === "owner" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === "owner" ? "Copied" : "Copy briefing"}</Button>
                    <Button type="button" disabled={!data?.ownerBriefing || sendingId !== null} onClick={() => data?.ownerBriefing && void send(targetPhone, data.ownerBriefing, "owner")} className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-700"><Send className={`h-3.5 w-3.5 ${sendingId === "owner" ? "animate-spin" : ""}`} />{sendingId === "owner" ? "Sending" : "Send via WhatsApp"}</Button>
                  </div>
                </div>
              ) : null}
              {!loading && activeTab === "clients" ? <ClientDrafts data={data} targetPhone={targetPhone} sendingId={sendingId} copiedId={copiedId} onCopy={copy} onSend={send} /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ClientDrafts({ data, targetPhone, sendingId, copiedId, onCopy, onSend }: { data: WhatsAppReminderResult | null; targetPhone: string; sendingId: string | null; copiedId: string | null; onCopy: (id: string, message: string) => Promise<void>; onSend: (phone: string, message: string, id: string) => Promise<void> }) {
  const clients = data?.clientMessages || [];
  if (!clients.length) return <div className="rounded-lg border p-6 text-center text-xs text-muted-foreground">No client reminders are due (reminders start after 30 days).</div>;
  return <div className="space-y-4">{clients.map((client: ClientReminderDraft) => {
    const id = `client-${client.customerId}`;
    return <div key={client.customerId} className="rounded-xl border p-4">
      <div className="flex flex-wrap justify-between gap-2 border-b pb-2"><div><strong className="text-sm">{client.customerName}</strong><div className="text-xs text-muted-foreground">Contact: {client.contactPerson}{client.mobile ? ` | ${client.mobile}` : " | No mobile number"}</div></div><div className="text-right text-xs"><strong>{client.totalAmount}</strong><div className="text-muted-foreground">{client.invoiceNumbers.join(", ")}</div></div></div>
      <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed">{client.message}</div>
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void onCopy(id, client.message)} className="h-7 text-[11px]">{copiedId === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copiedId === id ? "Copied" : "Copy"}</Button>{client.mobile ? <Button type="button" disabled={sendingId !== null} onClick={() => void onSend(client.mobile, client.message, id)} className="h-7 bg-emerald-600 text-[11px] text-white hover:bg-emerald-700"><Send className={`h-3 w-3 ${sendingId === id ? "animate-spin" : ""}`} />{sendingId === id ? "Sending" : "Send to client"}</Button> : null}<Button type="button" variant="secondary" disabled={sendingId !== null} onClick={() => void onSend(targetPhone, client.message, `owner-${id}`)} className="h-7 text-[11px]">Send draft to my phone</Button></div>
    </div>;
  })}</div>;
}
