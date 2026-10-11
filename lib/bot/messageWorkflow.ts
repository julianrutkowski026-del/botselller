import "server-only";

import crypto from "crypto";

import { checkInboxReplyForMessage } from "@/lib/bot/inboxChecker";
import { sendLeadEmail } from "@/lib/bot/mailer";
import { attachmentToMailerPayload } from "@/lib/attachmentStorage";
import { addGlobalSuppressionForMessage } from "@/lib/bot/suppression";
import { assertCanSendNow, getSendCapacity, isSendLimitError, requiredCampaignNumber, requiredCampaignTimeZone, SendLimitError } from "@/lib/bot/sendSafety";
import { addCalendarDaysSkippingWeekend, isWeekendInTimeZone, nextBusinessDayAtHour } from "@/lib/bot/businessDays";
import { domainKey } from "@/lib/bot/utils";
import { emailLanguageForCampaignLocation } from "@/lib/locationOptions";
import { adminDb } from "@/lib/supabaseAdmin";
import type { Campaign, ClientAccount, Lead, MessageStatus } from "@/lib/types";

const STOP_STATUSES = ["replied", "bounced", "spam", "failed", "unsubscribed"] as const;
const SENDABLE_STATUSES = ["draft", "approved", "queued", "failed"] as const;

type CampaignAttachmentForMail = {
  file_name: string;
  mime_type?: string | null;
  file_data_base64: string;
};

type WorkflowMessage = {
  id: string;
  client_id: string | null;
  campaign_id: string | null;
  lead_id: string | null;
  subject: string | null;
  body: string | null;
  status: MessageStatus;
  sent_at: string | null;
  created_at: string;
  tracking_id?: string | null;
  email_to: string | null;
  follow_up_count?: number | null;
  parent_message_id?: string | null;
  sequence_step?: number | null;
  client_accounts?: (ClientAccount & { smtp_pass_encrypted?: string | null; smtp_pass_iv?: string | null; smtp_pass_auth_tag?: string | null }) | null;
  campaigns?: Campaign | null;
  leads?: Lead | null;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function plusDays(days: number, timeZone: string, startHour: number) {
  return addCalendarDaysSkippingWeekend(days, startHour, timeZone).toISOString();
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedDateAtHour(base: Date, hour: number, timeZone: string) {
  const parts = getZonedParts(base, timeZone);
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, 0, 0, 0));
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function zonedDayBounds(timeZone: string, date = new Date()) {
  const start = zonedDateAtHour(date, 0, timeZone);
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const end = zonedDateAtHour(tomorrow, 0, timeZone);
  return { start, end };
}

function zonedMonthBounds(timeZone: string, date = new Date()) {
  const parts = getZonedParts(date, timeZone);
  const monthStartGuess = new Date(Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0, 0));
  const monthEndGuess = new Date(Date.UTC(parts.year, parts.month, 1, 0, 0, 0, 0));
  return {
    start: new Date(monthStartGuess.getTime() - timeZoneOffsetMs(monthStartGuess, timeZone)),
    end: new Date(monthEndGuess.getTime() - timeZoneOffsetMs(monthEndGuess, timeZone)),
  };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function startOfNextUtcDay(date = new Date()) {
  const next = startOfUtcDay(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

async function countQueuedToday(clientId: string, timeZone: string) {
  const bounds = zonedDayBounds(timeZone);
  const { count, error } = await adminDb()
    .from("send_queue")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("scheduled_at", bounds.start.toISOString())
    .lt("scheduled_at", bounds.end.toISOString())
    .in("status", ["awaiting_approval", "pending", "processing"]);
  if (error) throw error;
  return count || 0;
}

async function countQueuedThisMonth(clientId: string, timeZone: string) {
  const bounds = zonedMonthBounds(timeZone);
  const { count, error } = await adminDb()
    .from("send_queue")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("scheduled_at", bounds.start.toISOString())
    .lt("scheduled_at", bounds.end.toISOString())
    .in("status", ["awaiting_approval", "pending", "processing"]);
  if (error) throw error;
  return count || 0;
}

async function assertFollowUpQueueCapacity(parent: WorkflowMessage) {
  const client = parent.client_accounts;
  if (!client?.id) throw new Error("Follow-up nie ma aktywnego klienta.");
  const capacity = await getSendCapacity(client, parent.campaigns || null);
  if (!parent.campaigns) throw new Error("Follow-up nie ma przypisanej kampanii.");
  const timeZone = requiredCampaignTimeZone(parent.campaigns);
  const [queuedToday, queuedThisMonth] = await Promise.all([
    countQueuedToday(client.id, timeZone),
    countQueuedThisMonth(client.id, timeZone),
  ]);
  if (capacity.monthlyRemaining - queuedThisMonth <= 0) {
    throw new SendLimitError(
      "MONTHLY_LIMIT_REACHED",
      `Osiągnięto miesięczny limit klienta lub zaplanowano już cały limit: ${capacity.sentThisMonth}+${queuedThisMonth}/${capacity.monthlyLimit}.`,
      capacity.monthRetryAt,
    );
  }
  if (capacity.dailyRemaining - queuedToday <= 0) {
    throw new SendLimitError(
      "DAILY_LIMIT_REACHED",
      `Osiągnięto dzienny limit/warm-up albo zaplanowano już cały dzisiejszy limit: ${capacity.sentToday}+${queuedToday}/${capacity.dailyLimit}.`,
      capacity.dayRetryAt,
    );
  }
  return capacity;
}

async function suppressionMatchForParent(parent: WorkflowMessage, recipient: string) {
  const clientId = parent.client_id;
  if (!clientId) return false;
  const domain = domainKey(parent.leads?.website);
  const companyName = String(parent.leads?.company_name || "").trim().toLowerCase();
  const { data, error } = await adminDb()
    .from("suppression_list")
    .select("id,email,domain,company_name")
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .limit(1000);
  if (error) throw error;
  return (data || []).some((item) => {
    const blockedEmail = String(item.email || "").toLowerCase();
    const blockedDomain = String(item.domain || "").toLowerCase().replace(/^www\./, "");
    const blockedCompany = String(item.company_name || "").toLowerCase();
    if (blockedEmail && blockedEmail === recipient) return true;
    if (domain && blockedDomain && blockedDomain === domain) return true;
    if (companyName && blockedCompany && blockedCompany === companyName) return true;
    return false;
  });
}

async function nextQueuedSendSlot(parent: WorkflowMessage) {
  const campaign = parent.campaigns;
  const client = parent.client_accounts;
  if (!client?.id) return new Date(Date.now() + 60_000).toISOString();
  if (!campaign) throw new Error("Brakuje kampanii dla follow-upu.");

  const now = new Date();
  const startHour = Math.min(Math.max(Math.round(requiredCampaignNumber(campaign.workday_start_hour, "Godzina startu pracy bota")), 0), 23);
  const endHour = Math.min(Math.max(Math.round(requiredCampaignNumber(campaign.workday_end_hour, "Godzina końca pracy bota")), startHour + 1), 24);
  const timeZone = requiredCampaignTimeZone(campaign);
  const start = zonedDateAtHour(now, startHour, timeZone);
  const end = zonedDateAtHour(now, endHour, timeZone);
  let baseStart = start;
  let baseEnd = end;

  if (isWeekendInTimeZone(now, timeZone)) {
    baseStart = nextBusinessDayAtHour(now, startHour, timeZone);
    baseEnd = zonedDateAtHour(baseStart, endHour, timeZone);
  } else if (now.getTime() > end.getTime()) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    baseStart = nextBusinessDayAtHour(tomorrow, startHour, timeZone);
    baseEnd = zonedDateAtHour(baseStart, endHour, timeZone);
  }

  const capacity = await getSendCapacity(client, campaign || null);
  const campaignDailyLimit = Math.max(Math.round(requiredCampaignNumber(campaign.daily_limit, "Docelowa liczba maili dziennie")), 1);
  const dailyTarget = Math.max(Math.min(campaignDailyLimit, capacity.dailyLimit || 1, capacity.monthlyRemaining || 1), 1);
  const workMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 60_000);
  const intervalMs = Math.max(Math.floor(workMs / dailyTarget), 60_000);
  const queuedToday = await countQueuedToday(client.id, timeZone);
  const planned = new Date(baseStart.getTime() + queuedToday * intervalMs);
  const fallback = new Date(now.getTime() + (queuedToday + 1) * 60_000);
  return (planned.getTime() <= now.getTime() ? fallback : planned).toISOString();
}

async function loadActiveCampaignAttachments(campaignId: string | null) {
  if (!campaignId) return [] as CampaignAttachmentForMail[];
  const { data, error } = await adminDb()
    .from("campaign_attachments")
    .select("file_name,mime_type,file_data_base64,storage_bucket,storage_path")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const converted = await Promise.all((data || []).map((attachment) => attachmentToMailerPayload(attachment)));
  return converted.filter((attachment) => attachment.file_data_base64);
}

async function loadMessage(messageId: string) {
  const { data, error } = await adminDb()
    .from("messages")
    .select("*, client_accounts(*), campaigns(*), leads(*)")
    .eq("id", messageId)
    .single<WorkflowMessage>();
  if (error) throw error;
  if (!data) throw new Error("Nie znaleziono wiadomości.");
  return data;
}

function followUpSubject(subject: string | null, language: ReturnType<typeof emailLanguageForCampaignLocation>) {
  const subjectFallback: Record<string, string> = { pl: "Krótka wiadomość", en: "A short message", de: "Kurze Nachricht", fr: "Bref message", es: "Mensaje breve", it: "Messaggio breve", nl: "Kort bericht", pt: "Mensagem breve", cs: "Krátká zpráva", sk: "Krátka správa", da: "Kort besked", sv: "Kort meddelande", no: "Kort melding", fi: "Lyhyt viesti", ro: "Mesaj scurt", hu: "Rövid üzenet", el: "Σύντομο μήνυμα", uk: "Коротке повідомлення" };
  const clean = subject?.trim() || subjectFallback[language] || subjectFallback.en;
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function followUpBody(message: WorkflowMessage) {
  const language = emailLanguageForCampaignLocation(message.campaigns?.location_scope, message.campaigns?.target_locations, message.leads?.city);
  const companyFallback: Record<string, string> = { pl: "Państwa firmy", en: "your company", de: "Ihres Unternehmens", fr: "votre entreprise", es: "su empresa", it: "la vostra azienda", nl: "uw bedrijf", pt: "a vossa empresa", cs: "vaší společnosti", sk: "vašej spoločnosti", da: "jeres virksomhed", sv: "ert företag", no: "bedriften deres", fi: "yrityksestänne", ro: "compania dumneavoastră", hu: "az Önök vállalata", el: "της εταιρείας σας", uk: "вашої компанії" };
  const company = message.leads?.company_name || companyFallback[language] || companyFallback.en;
  const copy: Record<string, { greeting: string; followUp: string; gentle: string; question: string }> = {
    pl: { greeting: "Dzień dobry,", followUp: `wracam krótko do poprzedniej wiadomości dotyczącej ${company}.`, gentle: "Nie chcę zasypywać skrzynki, dlatego tylko dopytam, czy temat jest dla Państwa aktualny.", question: "Czy krótka rozmowa byłaby dla Państwa pomocna?" },
    en: { greeting: "Hello,", followUp: `I wanted to briefly follow up on my previous message regarding ${company}.`, gentle: "I do not want to overload your inbox, so I only wanted to ask whether this topic is relevant to you at the moment.", question: "Would a brief conversation be useful?" },
    de: { greeting: "Guten Tag,", followUp: `ich wollte kurz auf meine vorherige Nachricht zu ${company} zurückkommen.`, gentle: "Ich möchte Ihren Posteingang nicht unnötig belasten und wollte nur fragen, ob das Thema für Sie derzeit relevant ist.", question: "Wäre ein kurzes Gespräch für Sie hilfreich?" },
    fr: { greeting: "Bonjour,", followUp: `je me permets de revenir brièvement sur mon précédent message concernant ${company}.`, gentle: "Je ne souhaite pas encombrer votre boîte de réception et voulais simplement savoir si ce sujet est d’actualité pour vous.", question: "Un bref échange vous serait-il utile ?" },
    es: { greeting: "Buenos días,", followUp: `quería retomar brevemente mi mensaje anterior sobre ${company}.`, gentle: "No quiero llenar su bandeja de entrada; solo quería preguntar si este tema es relevante para ustedes en este momento.", question: "¿Les resultaría útil una breve conversación?" },
    it: { greeting: "Buongiorno,", followUp: `volevo riprendere brevemente il mio messaggio precedente riguardo a ${company}.`, gentle: "Non vorrei appesantire la vostra casella di posta; volevo solo chiedervi se l’argomento è attuale per voi.", question: "Potrebbe esservi utile una breve conversazione?" },
    nl: { greeting: "Goedendag,", followUp: `ik kom graag kort terug op mijn eerdere bericht over ${company}.`, gentle: "Ik wil uw inbox niet onnodig belasten en wilde alleen vragen of dit onderwerp op dit moment relevant voor u is.", question: "Zou een kort gesprek u helpen?" },
    pt: { greeting: "Bom dia,", followUp: `gostaria de retomar brevemente a minha mensagem anterior sobre ${company}.`, gentle: "Não quero sobrecarregar a sua caixa de entrada; queria apenas perguntar se este tema é relevante neste momento.", question: "Uma breve conversa seria útil?" },
    cs: { greeting: "Dobrý den,", followUp: `rád bych krátce navázal na svou předchozí zprávu týkající se společnosti ${company}.`, gentle: "Nechci zahlcovat vaši schránku, proto se jen zeptám, zda je toto téma pro vás aktuální.", question: "Byl by pro vás krátký rozhovor užitečný?" },
    sk: { greeting: "Dobrý deň,", followUp: `rád by som stručne nadviazal na svoju predchádzajúcu správu týkajúcu sa spoločnosti ${company}.`, gentle: "Nechcem zahltiť vašu schránku, preto sa len opýtam, či je táto téma pre vás aktuálna.", question: "Bol by pre vás krátky rozhovor užitočný?" },
    da: { greeting: "Goddag,", followUp: `jeg vil kort følge op på min tidligere besked om ${company}.`, gentle: "Jeg vil ikke fylde unødigt i din indbakke og ville blot høre, om emnet er relevant for jer lige nu.", question: "Ville en kort samtale være nyttig?" },
    sv: { greeting: "Hej,", followUp: `jag ville kort följa upp mitt tidigare meddelande om ${company}.`, gentle: "Jag vill inte belasta er inkorg i onödan och ville bara fråga om ämnet är aktuellt för er just nu.", question: "Skulle ett kort samtal vara till hjälp?" },
    no: { greeting: "Hei,", followUp: `jeg ville kort følge opp den forrige meldingen min om ${company}.`, gentle: "Jeg vil ikke fylle innboksen deres unødvendig, og ville bare høre om dette temaet er aktuelt for dere nå.", question: "Ville en kort samtale vært nyttig?" },
    fi: { greeting: "Hei,", followUp: `halusin palata lyhyesti aiempaan viestiini, joka koski yritystä ${company}.`, gentle: "En halua kuormittaa sähköpostilaatikkoanne, joten kysyn vain, onko aihe teille ajankohtainen.", question: "Olisiko lyhyt keskustelu hyödyllinen?" },
    ro: { greeting: "Bună ziua,", followUp: `revin pe scurt la mesajul meu anterior despre ${company}.`, gentle: "Nu doresc să vă aglomerez căsuța de e-mail și voiam doar să întreb dacă subiectul este relevant pentru dumneavoastră acum.", question: "V-ar fi utilă o scurtă discuție?" },
    hu: { greeting: "Jó napot kívánok!", followUp: `röviden szeretnék visszatérni a ${company} kapcsán küldött előző üzenetemre.`, gentle: "Nem szeretném feleslegesen terhelni a postaládáját; csak azt szeretném megkérdezni, aktuális-e most Önöknek ez a téma.", question: "Hasznos lenne egy rövid beszélgetés?" },
    el: { greeting: "Καλημέρα σας,", followUp: `θα ήθελα να επανέλθω σύντομα στο προηγούμενο μήνυμά μου σχετικά με την εταιρεία ${company}.`, gentle: "Δεν θέλω να επιβαρύνω τα εισερχόμενά σας και θα ήθελα μόνο να ρωτήσω αν το θέμα είναι επίκαιρο για εσάς.", question: "Θα σας ήταν χρήσιμη μια σύντομη συζήτηση;" },
    uk: { greeting: "Добрий день,", followUp: `хотів би коротко повернутися до попереднього повідомлення щодо компанії ${company}.`, gentle: "Не хочу перевантажувати вашу поштову скриньку, тому лише запитаю, чи актуальна для вас ця тема зараз.", question: "Чи була б вам корисною коротка розмова?" },
  };
  const localized = copy[language] || copy.en;
  return [localized.greeting, localized.followUp, localized.gentle, localized.question].join("\n\n");
}

function scheduledFollowUpAt(message: WorkflowMessage) {
  if (!message.campaigns?.follow_ups_enabled) return null;
  const maxFollowUps = Number(message.campaigns?.max_follow_ups ?? 1);
  const currentCount = Number(message.follow_up_count || 0);
  if (maxFollowUps <= currentCount) return null;
  const delay = Number(message.campaigns?.follow_up_delay_days ?? 2);
  if (!message.campaigns) throw new Error("Nie można zaplanować follow-upu bez kampanii.");
  const timeZone = requiredCampaignTimeZone(message.campaigns);
  const startHour = Math.min(Math.max(Math.round(requiredCampaignNumber(message.campaigns?.workday_start_hour, "Godzina startu pracy bota")), 0), 23);
  return plusDays(delay, timeZone, startHour);
}

export async function sendMessageById(messageId: string, options: { force?: boolean } = {}) {
  const db = adminDb();
  const message = await loadMessage(messageId);
  const recipient = normalizeEmail(message.email_to || message.leads?.email);
  const now = new Date().toISOString();
  const trackingId = message.tracking_id || crypto.randomUUID();

  if (!recipient) {
    await Promise.all([
      db.from("messages").update({ status: "skipped_no_email", email_to: null, follow_up_due_at: null, last_error: "Lead nie ma adresu email." }).eq("id", message.id),
      message.lead_id ? db.from("leads").update({ status: "skipped_no_email" }).eq("id", message.lead_id) : Promise.resolve({ error: null }),
    ]);
    return { ok: false as const, skipped: true as const, reason: "Lead nie ma adresu email." };
  }

  if (!message.client_accounts) throw new Error("Wiadomość nie ma przypisanego klienta.");
  if (!options.force && !SENDABLE_STATUSES.includes(message.status as any)) {
    throw new Error(`Nie można wysłać wiadomości ze statusem ${message.status}.`);
  }

  await assertCanSendNow(message.client_accounts, message.campaigns || null);

  await db
    .from("messages")
    .update({
      status: "queued",
      approved_at: message.status === "draft" ? now : undefined,
      tracking_id: trackingId,
      email_to: recipient,
      last_error: null,
    })
    .eq("id", message.id);

  try {
    await db.from("messages").update({ status: "sending" }).eq("id", message.id);
    const attachments = await loadActiveCampaignAttachments(message.campaign_id);
    const sendResult = await sendLeadEmail({
      client: message.client_accounts,
      to: recipient,
      subject: message.subject || "Wiadomość",
      body: message.body || "",
      campaignName: message.campaigns?.name,
      campaign: message.campaigns || null,
      recipientLocation: message.leads?.city,
      attachments,
      trackingId,
    });

    const sentAt = new Date().toISOString();
    const finalStatus: MessageStatus = Number(message.sequence_step || 0) > 0 || message.parent_message_id ? "follow_up_sent" : "sent";
    await Promise.all([
      db
        .from("messages")
        .update({
          status: finalStatus,
          sent_at: sentAt,
          delivered_at: sentAt,
          smtp_message_id: sendResult.messageId,
          provider_message_id: sendResult.messageId,
          failed_at: null,
          follow_up_due_at: scheduledFollowUpAt(message),
          last_error: null,
        })
        .eq("id", message.id),
      message.lead_id ? db.from("leads").update({ status: "sent" }).eq("id", message.lead_id) : Promise.resolve({ error: null }),
    ]);

    return { ok: true as const, sentAt, recipient };
  } catch (error) {
    const messageText = errorMessage(error, "Błąd wysyłki SMTP.");
    await Promise.all([
      db
        .from("messages")
        .update({ status: "failed", failed_at: new Date().toISOString(), follow_up_due_at: null, last_error: messageText })
        .eq("id", message.id),
      message.lead_id ? db.from("leads").update({ status: "failed" }).eq("id", message.lead_id) : Promise.resolve({ error: null }),
    ]);
    throw error;
  }
}

export async function applyMessageStatus(messageId: string, status: MessageStatus) {
  const db = adminDb();
  const now = new Date().toISOString();

  if (status === "queued") {
    return sendMessageById(messageId, { force: true });
  }

  const patch: Record<string, unknown> = { status };
  if (status === "delivered") patch.delivered_at = now;
  if (status === "opened") {
    patch.opened_at = now;
    patch.last_opened_at = now;
  }
  if (status === "replied") patch.replied_at = now;
  if (status === "bounced") patch.bounced_at = now;
  if (status === "spam") patch.spam_at = now;
  if (status === "failed") patch.failed_at = now;
  if (STOP_STATUSES.includes(status as any)) patch.follow_up_due_at = null;

  const { data: currentOpenData } = status === "opened"
    ? await db.from("messages").select("open_count,first_opened_at").eq("id", messageId).maybeSingle()
    : { data: null as any };
  if (status === "opened") {
    patch.open_count = Number(currentOpenData?.open_count || 0) + 1;
    patch.first_opened_at = currentOpenData?.first_opened_at || now;
  }

  const { data: updated, error } = await db.from("messages").update(patch).eq("id", messageId).select("lead_id").maybeSingle();
  if (error) throw error;

  if (updated?.lead_id && STOP_STATUSES.includes(status as any)) {
    // Lead zostaje w panelu jako wysłany. Bounce/spam/reply widać na statusie wiadomości.
    const leadStatus = status === "unsubscribed" ? "do_not_contact" : "sent";
    await db.from("leads").update({ status: leadStatus }).eq("id", updated.lead_id);
  }

  if (["bounced", "spam", "unsubscribed"].includes(status)) {
    await addGlobalSuppressionForMessage(messageId, `Globalna blokada automatyczna po statusie: ${status}.`);
  }

  return { ok: true as const };
}

export async function processDueFollowUps(limit = 20) {
  const db = adminDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("messages")
    .select("*, client_accounts(*), campaigns(*), leads(*)")
    .not("follow_up_due_at", "is", null)
    .lte("follow_up_due_at", now)
    .in("status", ["sent", "delivered", "opened", "follow_up_scheduled"])
    .order("follow_up_due_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results: Array<{ parentMessageId: string; ok: boolean; followUpMessageId?: string; error?: string; skipped?: string }> = [];

  for (const parent of (data || []) as WorkflowMessage[]) {
    try {
      if (!parent.campaigns?.follow_ups_enabled) {
        await db.from("messages").update({ follow_up_due_at: null }).eq("id", parent.id);
        results.push({ parentMessageId: parent.id, ok: true, skipped: "followupy_wylaczone" });
        continue;
      }

      const maxFollowUps = Number(parent.campaigns?.max_follow_ups ?? 1);
      const currentCount = Number(parent.follow_up_count || 0);
      if (currentCount >= maxFollowUps) {
        await db.from("messages").update({ follow_up_due_at: null }).eq("id", parent.id);
        results.push({ parentMessageId: parent.id, ok: true, skipped: "limit_followupow" });
        continue;
      }

      if (!parent.lead_id || !normalizeEmail(parent.email_to || parent.leads?.email)) {
        await db.from("messages").update({ follow_up_due_at: null }).eq("id", parent.id);
        results.push({ parentMessageId: parent.id, ok: true, skipped: "brak_emaila" });
        continue;
      }

      const recipient = normalizeEmail(parent.email_to || parent.leads?.email);

      const inboxCheck = await checkInboxReplyForMessage(parent);
      if ("replied" in inboxCheck && inboxCheck.replied) {
        results.push({ parentMessageId: parent.id, ok: true, skipped: inboxCheck.stopDetected ? "reply_stop_global_blacklist" : "reply_detected_in_inbox" });
        continue;
      }

      const { data: stopMessages, error: stopError } = await db
        .from("messages")
        .select("id,status")
        .eq("lead_id", parent.lead_id)
        .in("status", STOP_STATUSES as unknown as string[])
        .limit(1);
      if (stopError) throw stopError;
      if ((stopMessages || []).length) {
        await db.from("messages").update({ follow_up_due_at: null }).eq("id", parent.id);
        results.push({ parentMessageId: parent.id, ok: true, skipped: "lead_zakonczony" });
        continue;
      }

      if (await suppressionMatchForParent(parent, recipient)) {
        await db.from("messages").update({ follow_up_due_at: null }).eq("id", parent.id);
        results.push({ parentMessageId: parent.id, ok: true, skipped: "blacklist" });
        continue;
      }

      await assertFollowUpQueueCapacity(parent);

      const followUpCount = currentCount + 1;
      const scheduledAt = await nextQueuedSendSlot(parent);
      const { data: insertedQueue, error: insertError } = await db
        .from("send_queue")
        .insert({
          client_id: parent.client_id,
          campaign_id: parent.campaign_id,
          lead_id: parent.lead_id,
          parent_message_id: parent.id,
          kind: "follow_up",
          sequence_step: Number(parent.sequence_step || 0) + 1,
          follow_up_count: followUpCount,
          scheduled_at: scheduledAt,
          status: "pending",
          tracking_id: crypto.randomUUID(),
          email_to: recipient,
          subject: followUpSubject(parent.subject, emailLanguageForCampaignLocation(parent.campaigns?.location_scope, parent.campaigns?.target_locations, parent.leads?.city)),
          body: followUpBody(parent),
          lead_payload: {
            company_name: parent.leads?.company_name || "Lead",
            email: recipient,
          },
          generated_payload: { type: "follow_up", parent_message_id: parent.id, follow_up_count: followUpCount },
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      await db.from("messages").update({ follow_up_due_at: null, last_error: null }).eq("id", parent.id);

      results.push({ parentMessageId: parent.id, ok: true, followUpMessageId: insertedQueue.id });
    } catch (error) {
      const retryAt = isSendLimitError(error) ? error.retryAt : null;
      await db.from("messages").update({ follow_up_due_at: retryAt, last_error: retryAt ? errorMessage(error, "Limit wysyłki. Follow-up spróbuje ponownie później.") : null }).eq("id", parent.id);
      results.push({ parentMessageId: parent.id, ok: false, error: errorMessage(error, "Błąd follow-upa. Niewysłany follow-up został usunięty z panelu.") });
    }
  }

  return { processed: results.length, results };
}
