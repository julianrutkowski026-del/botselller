"use client";

import Link from "next/link";

import BotSellerLogo from "@/components/brand/BotSellerLogo";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useLanguage, type Language } from "@/components/i18n/LanguageContext";
import MarketingFooter from "@/components/public/MarketingFooter";
import { BOTSELLER_PLANS, formatGrossPriceFromNet, grossAmountGrosze } from "@/lib/pricing";

const copy = {
  pl: {
    nav: ["Jak działa", "Modele wdrożenia", "Korzyści", "Pakiety", "Bezpieczeństwo", "FAQ"],
    login: "Zaloguj się",
    signup: "Załóż SalesBota",
    heroPill: "FluxBase BotSeller · AI Sales Bot",
    heroTitle: <>Prospecting B2B, który <em>porządkuje</em> codzienną pracę sprzedaży</>,
    heroSub:
      "FluxBase BotSeller pomaga wyszukiwać i kwalifikować firmy, przygotowywać pierwsze wiadomości dopasowane do oferty oraz prowadzić wysyłkę według ustawień kampanii. Zespół obsługuje odpowiedzi w jednym panelu.",
    heroCta: "Zobacz pakiety",
    heroSecondary: "Sprawdź, jak działa",
    heroPoints: ["Wyszukiwanie i kwalifikacja firm", "Wiadomości dopasowane do oferty", "Kontrola wysyłki i odpowiedzi"],
    mockup: {
      top: "Widok demonstracyjny · dane przykładowe",
      metrics: [["W kolejce", "8", "przykładowe dane"], ["Status skrzynki", "Aktywna", "przykładowe dane"], ["Odpowiedzi", "6", "przykładowe dane"]],
      chart: "Aktywność kampanii",
      days: "przykładowy tydzień",
      queue: [["Studio Meblowe Nowak", "Przyjęta przez serwer SMTP", "delivered"], ["Kancelaria LexPartner", "Odpowiedź od firmy", "replied"], ["Pracownia Reklamy 360", "Zaplanowano wysyłkę", "queued"]],
      floatA: ["Wiadomość do sprawdzenia", "„Dzień dobry, przygotowujemy strony dla…”"],
      floatB: ["Odpowiedź w panelu", "„Proszę o wycenę i szczegóły oferty.”"],
    },
    audienceIntro: "Dla zespołów, które chcą uporządkować regularny prospecting B2B:",
    audience: ["Agencje", "Firmy usługowe", "Software house'y", "Lokalne biznesy", "B2B", "Logistyka i produkcja"],
    deployment: {
      eyebrow: "Modele wdrożenia",
      title: "Wybierz, czego potrzebuje Twój biznes",
      body: "Możesz korzystać z SalesBota w swojej firmie albo omówić przejęcie pełnej platformy FluxBase BotSeller i prowadzenie własnej sprzedaży pakietów.",
      panelLabel: "Dla własnego zespołu",
      panelTitle: "Panel klienta SalesBot",
      panelBody: "Wybierasz pakiet, przekazujesz brief, a FluxBase konfiguruje skrzynkę i przygotowuje konto do pracy nad Twoimi kampaniami.",
      panelPoints: ["Panel klienta do obsługi leadów i kampanii", "Pakiet dopasowany do limitu wysyłki", "Aktywacja po sprawdzeniu konfiguracji"],
      panelCta: "Zobacz pakiety SalesBot",
      platformLabel: "Dla partnera lub operatora",
      platformTitle: "Pełna platforma FluxBase BotSeller",
      platformBody: "Rozwiązanie dla osoby lub firmy, która chce przejąć cały produkt i sprzedawać pakiety SalesBot pod marką FluxBase BotSeller.",
      platformPoints: ["Strona główna i formularz zamówień", "Stripe, panel klienta i panel administratora", "Supabase oraz konfiguracja wdrożenia do uzgodnienia"],
      platformCta: "Zapytaj o pełne wdrożenie",
      note: "Pełne wdrożenie ustalamy indywidualnie: zakres przekazania, domenę, konta płatnicze, hosting, bazę i dalszą obsługę.",
    },
    seo: {
      eyebrow: "FluxBase BotSeller",
      title: "Od wyszukania firm do obsługi odpowiedzi — w jednym panelu",
      body: "BotSeller łączy wyszukiwanie firm, kwalifikację kontaktów, przygotowanie wiadomości i obsługę kampanii. Ty ustalasz ofertę, odbiorców i zasady komunikacji; system realizuje skonfigurowany proces.",
      topics: [
        ["Wyszukiwanie według kryteriów", "Ustal branże, lokalizację i wykluczenia. SalesBot zbiera pasujące firmy oraz pomija rekordy bez adresu potrzebnego do kontaktu."],
        ["Wiadomości dopasowane do oferty", "Przekaż opis usługi, ton komunikacji i przykład wiadomości. Treści przygotowane przez AI można sprawdzić i dopracować przed uruchomieniem kampanii."],
        ["Wysyłka według harmonogramu", "Wiadomości trafiają do kolejki i są wysyłane w ustawionym oknie oraz limitach kampanii. Warm-up pomaga stopniowo zwiększać tempo, ale nie gwarantuje dostarczenia do głównej skrzynki odbiorczej."],
        ["Obsługa kampanii w jednym miejscu", "Panel klienta pokazuje kontakty, wiadomości i ich statusy, a także odpowiedzi oraz zaplanowane follow-upy."],
      ],
    },
    phrases: ["automatyzacja sprzedaży B2B", "automatyzacja maili B2B", "pozyskiwanie leadów B2B", "prospecting B2B", "AI Sales Bot", "cold mailing", "follow-upy sprzedażowe", "FluxBase BotSeller"],
    workflow: {
      eyebrow: "Jak działa",
      title: "Od kryteriów wyszukiwania do rozmowy z klientem",
      body: "Ty określasz ofertę i odbiorców. BotSeller porządkuje kolejne etapy kampanii, a zespół przejmuje zainteresowane odpowiedzi.",
      steps: [["01", "Określasz odbiorców", "Wybierasz branże, obszar działania oraz kryteria kwalifikacji."], ["02", "System wyszukuje firmy", "Zbiera pasujące firmy z wybranego obszaru i dostępnych źródeł."], ["03", "Kwalifikuje kontakty", "Pomija rekordy bez potrzebnych danych i stosuje wskazane wykluczenia."], ["04", "Przygotowuje wiadomość", "AI korzysta z opisu oferty, tonu marki i wskazanego wezwania do działania."], ["05", "Wiadomość trafia do kolejki", "Wysyłka odbywa się w oknie i limitach ustawionych dla kampanii."], ["06", "Zespół obsługuje odpowiedzi", "Panel zbiera statusy wiadomości i odpowiedzi, aby łatwiej zaplanować kolejny krok."]],
    },
    benefits: {
      eyebrow: "Korzyści",
      title: "Mniej ręcznej pracy przy prospectingu, więcej kontroli nad kampanią",
      items: [["Powtarzalny proces", "Ustawiasz kryteria i harmonogram. System wspiera regularną pracę nad nowymi kontaktami."], ["Lepsza jakość listy", "Kwalifikacja i wykluczenia pomagają ograniczyć kontakty poza ustalonym targetem."], ["Treść oparta na Twojej ofercie", "AI przygotowuje szkic na podstawie briefu, tonu marki i przykładowej wiadomości."], ["Jeden panel do pracy", "Kontakty, statusy wiadomości, odpowiedzi i follow-upy są zebrane w jednym miejscu."]],
    },
    safety: {
      eyebrow: "Bezpieczna wysyłka",
      title: "Kontrolowane tempo i jasne zasady kontaktu",
      body: "Wiadomości przechodzą przez kolejkę i są wysyłane w zaplanowanym oknie. Limity oraz odstępy dopasowuje się do pakietu, skrzynki i konfiguracji kampanii.",
      points: [["Stopniowe zwiększanie limitu", "Warm-up może zwiększać dzienny limit etapami. Harmonogram i wartość docelową ustala się przed aktywacją kampanii."], ["Wysyłka w zaplanowanych godzinach", "Kolejka respektuje okno pracy, odstępy między wiadomościami i limit kampanii."], ["Obsługa rezygnacji", "Prośby o zaprzestanie kontaktu trafiają na listę blokad i są pomijane w kolejnych kampaniach."], ["Follow-up tylko według ustawień", "Przypomnienia są planowane z określonym odstępem. System sprawdza dostępne sygnały odpowiedzi przed dalszym kontaktem."]],
      schedule: ["Start", "+2h", "+4h", "+6h", "+8h", "Koniec"],
      scheduleStart: "start",
      scheduleEnd: "koniec",
      scheduleMail: "mail",
    },
    panel: {
      eyebrow: "Panel klienta",
      title: "Widzisz przebieg kampanii i wiesz, co wymaga reakcji",
      body: "Panel klienta porządkuje leady, statusy wiadomości, odpowiedzi i follow-upy. Status „przyjęta przez SMTP” oznacza akceptację przez serwer pocztowy, nie gwarantuje wyświetlenia w skrzynce odbiorczej.",
      login: "Zaloguj się do panelu",
      stats: ["Wysłane", "Dostarczone", "Otwarte", "Odpowiedzi", "Follow-upy", "Leady"],
    },
    plans: {
      eyebrow: "Pakiety",
      title: "Wybierz pakiet dla swojego SalesBota",
      body: "Każdy pakiet pokazuje limit i koszt netto oraz brutto. Wersja próbna jest płatnością jednorazową; pozostałe pakiety odnawiają się co miesiąc. Uruchomienie następuje po sprawdzeniu konfiguracji.",
      recommended: "Polecany pakiet",
      choose: "Wybierz plan",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Najczęstsze pytania",
      items: [["Czy firmy bez maila trafiają do panelu?", "Nie. System pomija rekordy bez adresu e-mail, który jest potrzebny do kontaktu."], ["Czy bot wysyła wszystkie maile naraz?", "Nie. Wiadomości przechodzą przez kolejkę i są wysyłane zgodnie z harmonogramem oraz limitami kampanii."], ["Czy mogę wybrać kraje Europy?", "Obecne pakiety w formularzu obejmują Polskę: całą Polskę albo wybrane województwa. Szerszy zasięg wymaga indywidualnego ustalenia."], ["Czy bot pisze maile moim stylem?", "AI przygotowuje treść na podstawie opisu oferty, tonu komunikacji, przykładowej wiadomości i wskazówek przekazanych w formularzu."], ["Czy mogę dodać załączniki?", "Tak. Do briefu możesz dodać do pięciu plików. Po aktywacji można je podpiąć do wiadomości kampanii."], ["Jak działa warm-up?", "Limit może rosnąć etapami, np. od 5 wiadomości dziennie. Wartość docelowa i harmonogram są ustalane dla kampanii."], ["Czy status wysłania oznacza, że wiadomość jest w skrzynce odbiorczej?", "Nie. Status przyjęcia przez SMTP potwierdza, że serwer pocztowy przyjął wiadomość do dalszej obsługi. Nie potwierdza jej umieszczenia w głównej skrzynce ani przeczytania."], ["Czy po płatności SalesBot uruchamia się od razu?", "Nie. FluxBase sprawdza brief i konfigurację, a następnie ręcznie aktywuje konto oraz kampanię."], ["Czy mogę sprzedawać pakiety SalesBota swoim klientom?", "Taką współpracę omawiamy jako osobne wdrożenie całej platformy FluxBase BotSeller. Zakres, dostęp do strony, paneli, płatności i infrastruktury ustalamy indywidualnie."]],
    },
    final: {
      eyebrow: "Gotowy na start?",
      title: "Zaplanuj start swojego SalesBota",
      body: "Przygotuj informacje o ofercie, odbiorcach i skrzynce do odpowiedzi. Po płatności FluxBase sprawdzi konfigurację i skontaktuje się w sprawie aktywacji.",
      cta: "Załóż SalesBota",
    },
    features: (plan: (typeof BOTSELLER_PLANS)[number]) => [
      `Do ${plan.dailyEmails} wiadomości dziennie po warm-upie`,
      plan.billingMode === "payment" ? `${plan.totalEmails || 100} wiadomości w ${plan.durationDays || 5}-dniowym teście` : `Do ${plan.monthlyEmails.toLocaleString("pl-PL", { useGrouping: "always" })} wiadomości w miesiącu`,
      "Skrzynka wysyłkowa konfigurowana przez FluxBase",
      "Wiadomości przygotowane na podstawie Twojego briefu",
      "Kolejka wysyłki i panel klienta",
    ],
  },
  en: {
    nav: ["How it works", "Deployment options", "Benefits", "Plans", "Safe sending", "FAQ"],
    login: "Log in",
    signup: "Start SalesBot",
    heroPill: "FluxBase BotSeller · AI Sales Bot",
    heroTitle: <>B2B prospecting that <em>organizes</em> your sales workflow</>,
    heroSub:
      "FluxBase BotSeller helps find and qualify companies, prepare first messages based on your offer, and send them according to campaign settings. Your team manages replies in one panel.",
    heroCta: "View plans",
    heroSecondary: "See how it works",
    heroPoints: ["Company search and qualification", "Messages based on your offer", "Sending and reply tracking"],
    mockup: {
      top: "Demo view · sample data",
      metrics: [["In queue", "8", "sample data"], ["Mailbox status", "Active", "sample data"], ["Replies", "6", "sample data"]],
      chart: "Campaign activity",
      days: "sample week",
      queue: [["Nowak Furniture Studio", "Accepted by SMTP server", "delivered"], ["LexPartner Law Office", "Company reply", "replied"], ["Ad Studio 360", "Sending scheduled", "queued"]],
      floatA: ["Message ready to review", "“Hello, we build websites for…”"],
      floatB: ["Reply in the panel", "“Please send pricing and offer details.”"],
    },
    audienceIntro: "For teams that want a more organized B2B prospecting process:",
    audience: ["Agencies", "Service companies", "Software houses", "Local businesses", "B2B", "Logistics and production"],
    deployment: {
      eyebrow: "Deployment options",
      title: "Choose what your business needs",
      body: "Use SalesBot in your own business or discuss taking over the full FluxBase BotSeller platform and selling plans yourself.",
      panelLabel: "For your own team",
      panelTitle: "SalesBot client panel",
      panelBody: "Choose a plan and share your brief. FluxBase configures the mailbox and prepares the account for your campaigns.",
      panelPoints: ["Client panel for leads and campaigns", "Plan matched to your sending limit", "Activation after configuration review"],
      panelCta: "View SalesBot plans",
      platformLabel: "For a partner or operator",
      platformTitle: "Full FluxBase BotSeller platform",
      platformBody: "For a person or company that wants to take over the complete product and sell SalesBot plans under the FluxBase BotSeller brand.",
      platformPoints: ["Homepage and order form", "Stripe, client panel and admin panel", "Supabase and deployment setup to be agreed"],
      platformCta: "Ask about a full deployment",
      note: "A full deployment is scoped individually, including handover, domain, payment accounts, hosting, database and ongoing operations.",
    },
    seo: {
      eyebrow: "FluxBase BotSeller",
      title: "From finding companies to managing replies — in one panel",
      body: "BotSeller brings together company search, contact qualification, message preparation and campaign management. You set the offer, audience and communication rules; the system runs the configured workflow.",
      topics: [
        ["Search by criteria", "Choose industries, locations and exclusions. SalesBot gathers matching companies and skips records without the contact details the campaign needs."],
        ["Messages based on your offer", "Share your service description, communication tone and a sample message. AI-prepared content can be reviewed and refined before launch."],
        ["Sending on a schedule", "Messages enter a queue and send within your campaign window and limits. Warm-up can increase sending volume gradually, but does not guarantee inbox placement."],
        ["Campaign management in one place", "The client panel shows contacts, message statuses, replies and planned follow-ups."],
      ],
    },
    phrases: ["B2B sales automation", "B2B email automation", "B2B lead generation", "B2B prospecting", "AI Sales Bot", "cold mailing", "sales follow-ups", "FluxBase BotSeller"],
    workflow: {
      eyebrow: "How it works",
      title: "From search criteria to a conversation with a prospect",
      body: "You define the offer and audience. BotSeller organizes the campaign workflow, and your team takes over interested replies.",
      steps: [["01", "Define your audience", "Choose industries, locations and qualification criteria."], ["02", "The system finds companies", "It gathers matching companies in your selected area and available sources."], ["03", "Contacts are qualified", "Records without required details are skipped and exclusions are applied."], ["04", "A message is prepared", "AI uses your offer description, brand tone and call to action."], ["05", "Messages enter a queue", "Sending follows the campaign window and limits you set."], ["06", "Your team handles replies", "The panel brings message statuses and replies together so you can plan the next step."]],
    },
    benefits: {
      eyebrow: "Benefits",
      title: "Less manual prospecting, more control over campaigns",
      items: [["A repeatable process", "Set criteria and a schedule. The system supports regular work on new prospects."], ["A more relevant list", "Qualification and exclusions help limit contacts outside your chosen audience."], ["Content based on your offer", "AI prepares a draft from your brief, brand tone and sample message."], ["One place to work", "Contacts, message statuses, replies and follow-ups are gathered in one panel."]],
    },
    safety: {
      eyebrow: "Safe sending",
      title: "Controlled sending and clear contact rules",
      body: "Messages move through a queue and send in a scheduled window. Limits and spacing are set for the plan, mailbox and campaign configuration.",
      points: [["Gradual limit increases", "Warm-up can increase the daily limit in stages. The schedule and target are set before a campaign is activated."], ["Sending in scheduled hours", "The queue respects the campaign window, spacing between messages and sending limit."], ["Unsubscribe handling", "Requests to stop contact are added to a suppression list and skipped in future campaigns."], ["Follow-ups follow your settings", "Reminders are scheduled at the interval you choose. Available reply signals are checked before further contact."]],
      schedule: ["Start", "+2h", "+4h", "+6h", "+8h", "End"],
      scheduleStart: "start",
      scheduleEnd: "end",
      scheduleMail: "email",
    },
    panel: {
      eyebrow: "Client panel",
      title: "See campaign activity and what needs your attention",
      body: "The client panel organizes leads, message statuses, replies and follow-ups. “Accepted by SMTP” means the mail server accepted the message for processing; it does not guarantee inbox placement.",
      login: "Log in to panel",
      stats: ["Sent", "Delivered", "Opened", "Replies", "Follow-ups", "Leads"],
    },
    plans: {
      eyebrow: "Plans",
      title: "Choose a plan for your SalesBot",
      body: "Each plan shows its net and gross price. The trial is a one-time payment; other plans renew monthly. Service activation follows a configuration review.",
      recommended: "Recommended plan",
      choose: "Choose plan",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions",
      items: [["Do companies without email enter the panel?", "No. The system skips records without an email address needed for contact."], ["Does the bot send all emails at once?", "No. Messages move through a queue and send according to the campaign schedule and limits."], ["Can I choose European countries?", "Current plans in the form cover Poland: all of Poland or selected regions. Wider coverage needs to be agreed separately."], ["Does the bot write in my style?", "AI prepares content based on your offer, communication tone, sample message and instructions from the form."], ["Can I add attachments?", "Yes. You can attach up to five files to your brief. After activation they can be added to campaign messages."], ["How does warm-up work?", "The limit can increase in stages, for example starting at 5 messages a day. The schedule and target limit are set for the campaign."], ["Does a sent status mean the message is in the inbox?", "No. SMTP acceptance confirms that the mail server accepted the message for processing. It does not confirm inbox placement or that the message was read."], ["Does SalesBot start immediately after payment?", "No. FluxBase reviews the brief and configuration, then activates the account and campaign manually."], ["Can I sell SalesBot plans to my own clients?", "We discuss this as a separate deployment of the full FluxBase BotSeller platform. The scope for the public site, panels, payments and infrastructure is agreed individually."]],
    },
    final: {
      eyebrow: "Ready to start?",
      title: "Plan your SalesBot launch",
      body: "Prepare details about your offer, audience and reply mailbox. After payment, FluxBase will review the configuration and contact you about activation.",
      cta: "Start SalesBot",
    },
    features: (plan: (typeof BOTSELLER_PLANS)[number]) => [
      `Up to ${plan.dailyEmails} messages a day after warm-up`,
      plan.billingMode === "payment" ? `${plan.totalEmails || 100} messages during the ${plan.durationDays || 5}-day trial` : `Up to ${plan.monthlyEmails.toLocaleString("en-GB", { useGrouping: "always" })} messages per month`,
      "Sending mailbox configured by FluxBase",
      "Messages prepared from your brief",
      "Sending queue and client panel",
    ],
  },
} satisfies Record<Language, Record<string, unknown>>;

function formatLocalizedPlanPrice(plan: (typeof BOTSELLER_PLANS)[number], language: Language) {
  const amount = new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-GB", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
    useGrouping: "always",
  }).format(plan.pricePln);
  const period = plan.billingMode === "payment"
    ? language === "pl" ? `za ${plan.durationDays || 5} dni` : `for ${plan.durationDays || 5} days`
    : language === "pl" ? "/ miesiąc" : "/ month";
  const net = language === "pl" ? "netto" : "net";
  return `${amount} ${net} ${period}`;
}

export default function LandingPage() {
  const { language } = useLanguage();
  const t = copy[language] as typeof copy.pl;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "FluxBase",
      url: "https://www.fluxbase.pl",
      logo: "https://www.fluxbase.pl/icon.png",
      sameAs: ["https://www.fluxbase.pl"],
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "FluxBase BotSeller",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: language === "pl" ? "AI Sales Bot do automatyzacji maili, prospectingu B2B, pozyskiwania leadów, cold mailingu i follow-upów." : "AI Sales Bot for email automation, B2B prospecting, lead generation, cold mailing and follow-ups.",
      url: "https://www.fluxbase.pl/",
      offers: BOTSELLER_PLANS.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: grossAmountGrosze(plan.pricePln) / 100,
        priceCurrency: "PLN",
        availability: "https://schema.org/InStock",
        url: "https://www.fluxbase.pl/botseller",
      })),
      featureList: t.phrases,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: t.faq.items.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <main className="marketing-page marketing-v2 lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="marketing-nav marketing-nav-v2">
        <Link className="marketing-brand" href="/">
          <BotSellerLogo variant="header" />
        </Link>
        <nav>
          <a href="#jak-dziala">{t.nav[0]}</a>
          <a href="#wdrozenia">{t.nav[1]}</a>
          <a href="#korzysci">{t.nav[2]}</a>
          <a href="#pakiety">{t.nav[3]}</a>
          <a href="#bezpieczenstwo">{t.nav[4]}</a>
          <a href="#faq">{t.nav[5]}</a>
          <Link className="nav-login" href="/client/login">{t.login}</Link>
          <Link className="nav-cta" href="/botseller">{t.signup}</Link>
          <LanguageSwitcher />
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <p className="hero-pill">{t.heroPill}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lp-hero-sub">{t.heroSub}</p>
          <div className="hero-actions">
            <Link className="primary-link lp-cta" href="#pakiety">{t.heroCta}</Link>
            <a className="secondary-link" href="#jak-dziala">{t.heroSecondary}</a>
          </div>
          <div className="hero-points">
            {t.heroPoints.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>

        <div className="lp-hero-visual" aria-hidden="true">
          <div className="lp-mockup">
            <div className="lp-mockup-topbar">
              <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
              <strong>{t.mockup.top}</strong>
            </div>
            <div className="lp-mockup-metrics">
              {t.mockup.metrics.map(([label, value, detail]) => (
                <div key={label}><span>{label}</span><strong>{value}</strong><small className="lp-up">{detail}</small></div>
              ))}
            </div>
            <div className="lp-mockup-chart">
              <div className="lp-chart-head"><span>{t.mockup.chart}</span><b>{t.mockup.days}</b></div>
              <div className="lp-bars">{[42, 58, 47, 72, 64, 88, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
            </div>
            <div className="lp-mockup-queue">
              {t.mockup.queue.map(([name, detail, tone]) => (
                <div key={name} className="lp-queue-row"><div><strong>{name}</strong><span>{detail}</span></div><i className={`lp-queue-status ${tone}`} /></div>
              ))}
            </div>
          </div>
          <div className="lp-float-card lp-float-a"><strong>{t.mockup.floatA[0]}</strong><span>{t.mockup.floatA[1]}</span></div>
          <div className="lp-float-card lp-float-b"><strong>{t.mockup.floatB[0]}</strong><span>{t.mockup.floatB[1]}</span></div>
        </div>
      </section>

      <section className="lp-audience-band"><span>{t.audienceIntro}</span><div>{t.audience.map((item) => <b key={item}>{item}</b>)}</div></section>

      <section className="deployment-section" id="wdrozenia">
        <div className="section-heading left">
          <span className="eyebrow">{t.deployment.eyebrow}</span>
          <h2>{t.deployment.title}</h2>
          <p>{t.deployment.body}</p>
        </div>
        <div className="deployment-grid">
          <article className="deployment-card">
            <span className="deployment-label">{t.deployment.panelLabel}</span>
            <h3>{t.deployment.panelTitle}</h3>
            <p>{t.deployment.panelBody}</p>
            <ul>{t.deployment.panelPoints.map((point) => <li key={point}>{point}</li>)}</ul>
            <Link className="lp-plan-cta" href="/botseller">{t.deployment.panelCta}</Link>
          </article>
          <article className="deployment-card deployment-card-featured">
            <span className="deployment-label">{t.deployment.platformLabel}</span>
            <h3>{t.deployment.platformTitle}</h3>
            <p>{t.deployment.platformBody}</p>
            <ul>{t.deployment.platformPoints.map((point) => <li key={point}>{point}</li>)}</ul>
            <a className="lp-plan-cta featured" href="mailto:office@fluxbase.pl?subject=FluxBase%20BotSeller%20-%20pelne%20wdrozenie">{t.deployment.platformCta}</a>
          </article>
        </div>
        <p className="deployment-note">{t.deployment.note}</p>
      </section>

      <section className="seo-section" aria-labelledby="seo-title">
        <div className="section-heading left"><span className="eyebrow">{t.seo.eyebrow}</span><h2 id="seo-title">{t.seo.title}</h2><p>{t.seo.body}</p></div>
        <div className="seo-grid">{t.seo.topics.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="soft-section" id="jak-dziala">
        <div className="section-heading left"><span className="eyebrow">{t.workflow.eyebrow}</span><h2>{t.workflow.title}</h2><p>{t.workflow.body}</p></div>
        <div className="workflow-grid">{t.workflow.steps.map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="lp-benefits" id="korzysci">
        <div className="section-heading"><span className="eyebrow">{t.benefits.eyebrow}</span><h2>{t.benefits.title}</h2></div>
        <div className="lp-benefits-grid">{t.benefits.items.map(([title, body]) => <article key={title}><i className="lp-benefit-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg></i><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="schedule-section" id="bezpieczenstwo">
        <div className="schedule-copy"><span className="eyebrow">{t.safety.eyebrow}</span><h2>{t.safety.title}</h2><p>{t.safety.body}</p><div className="lp-trust-list">{t.safety.points.map(([title, body]) => <div key={title}><strong>{title}</strong><span>{body}</span></div>)}</div></div>
        <div className="schedule-visual" aria-label={language === "pl" ? "Przykładowy harmonogram wysyłki" : "Sample sending schedule"}>{t.safety.schedule.map((hour, index) => <div key={hour} className={index % 2 ? "slot muted" : "slot"}><span>{hour}</span><strong>{index === 0 ? t.safety.scheduleStart : index === 5 ? t.safety.scheduleEnd : t.safety.scheduleMail}</strong></div>)}</div>
      </section>

      <section className="panel-preview-section">
        <div className="section-heading left"><span className="eyebrow">{t.panel.eyebrow}</span><h2>{t.panel.title}</h2><p>{t.panel.body}</p><Link className="secondary-link lp-inline-cta" href="/client/login">{t.panel.login}</Link></div>
        <div className="panel-stat-grid">{t.panel.stats.map((stat) => <div key={stat}>{stat}</div>)}</div>
      </section>

      <section className="plans-section plans-section-v2" id="pakiety">
        <div className="section-heading"><span className="eyebrow">{t.plans.eyebrow}</span><h2>{t.plans.title}</h2><p>{t.plans.body}</p></div>
        <div className="plans-grid plans-grid-v2">
          {BOTSELLER_PLANS.map((plan) => <article className={plan.recommended ? "plan-card featured" : "plan-card"} key={plan.id}>{plan.recommended ? <span className="pill">{t.plans.recommended}</span> : null}<h3>{plan.name.replace("BotSeller ", "")}</h3><div className="lp-plan-price"><strong>{formatLocalizedPlanPrice(plan, language)}</strong><small>{language === "pl" ? `Kwota brutto: ${formatGrossPriceFromNet(plan.pricePln, "pl-PL")}` : `Gross total: ${formatGrossPriceFromNet(plan.pricePln, "en-GB")}`}</small></div><ul className="lp-plan-features">{t.features(plan).map((feature) => <li key={feature}>{feature}</li>)}</ul><Link className={plan.recommended ? "lp-plan-cta featured" : "lp-plan-cta"} href="/botseller">{t.plans.choose}</Link></article>)}
        </div>
      </section>

      <section className="faq-section" id="faq"><div className="section-heading"><span className="eyebrow">{t.faq.eyebrow}</span><h2>{t.faq.title}</h2></div><div className="faq-grid">{t.faq.items.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>

      <section className="final-cta"><span className="eyebrow lp-cta-eyebrow">{t.final.eyebrow}</span><h2>{t.final.title}</h2><p className="lp-final-sub">{t.final.body}</p><Link className="primary-link lp-cta" href="/botseller">{t.final.cta}</Link></section>

      <MarketingFooter />
    </main>
  );
}
