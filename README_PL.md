# FluxBase BotSeller Admin - Stripe + design cleanup

Wersja zawiera:

- usunięte publiczne wyświetlanie szacunkowych kosztów AI,
- publiczną stronę `/botseller` z płatnością przez Stripe Checkout,
- endpoint `POST /api/stripe/checkout-session`,
- endpoint webhooka `POST /api/stripe/webhook`,
- nowe pola Stripe w `signup_orders`,
- poprawiony widok Billing i Zamówienia,
- ceny pakietów bez pokazywania kosztów wewnętrznych,
- build/TypeScript sprawdzone.

## Uruchomienie

```sh
npm ci
npm run dev
```

Admin:

```txt
http://localhost:3000
```

Publiczna strona zamówienia:

```txt
http://localhost:3000/botseller
```

Panel klienta:

```txt
http://localhost:3000/client/login
```

## .env.local

Skopiuj `.env.example` jako `.env.local` i uzupełnij wymagane klucze. Plik zawiera najważniejsze zmienne konfiguracyjne; nie wpisuj sekretów do `.env.example`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SECRET_ENCRYPTION_KEY=
ADMIN_EMAILS=office@fluxbase.pl
CRON_SECRET=
CLIENT_PORTAL_SECRET=
NEXT_PUBLIC_BASE_URL=http://localhost:3000

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# Price ID nie są potrzebne w env. Aplikacja szuka aktywnych cen Stripe po metadanych produktu/ceny.
```

## Supabase SQL

Uruchom w Supabase cały plik:

```txt
supabase/schema.sql
```

Dodaje między innymi pola:

- `stripe_checkout_session_id`,
- `stripe_customer_id`,
- `stripe_subscription_id`,
- `stripe_payment_status`,
- `stripe_price_id`,
- `paid_at`,
- `payment_error`.

## Stripe Checkout bez Price ID w ENV

Nie dodajesz żadnych `STRIPE_PRICE_*` ani `price_...` do `.env`. Checkout tworzy pozycje płatności bezpośrednio z kodu przez `price_data`, więc nie musi szukać aktywnej ceny w katalogu Stripe.

W `.env` / Vercel zostają tylko standardowe klucze Stripe:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Ceny w kodzie są netto:

- Wersja próbna: 250 zł netto / 5 dni, one-time
- Starter: 999 zł netto / miesiąc
- Growth: 1999 zł netto / miesiąc
- Pro: 3999 zł netto / miesiąc
- Dodatkowa skrzynka / bot: 1500 zł netto / miesiąc

Produkty w katalogu Stripe mogą istnieć, ale nie są wymagane do działania checkoutu.

## Stripe webhook

Dodaj webhook w Stripe do endpointu:

```txt
https://twoja-domena.pl/api/stripe/webhook
```

Eventy:

```txt
checkout.session.completed
invoice.paid
invoice.payment_failed
customer.subscription.deleted
```

Webhook signing secret wklej do:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Test

1. Wejdź na `/botseller`.
2. Wybierz pakiet.
3. Wypełnij formularz.
4. Kliknij „Przejdź do płatności Stripe”.
5. Po opłaceniu webhook ustawi zamówienie jako `paid`.
6. W adminie sprawdź zakładkę `Zamówienia`.

## Sprawdzenie kodu

Testy i kontrolę typów uruchomisz poleceniami:

```sh
npm test
npm run typecheck
npm run build
```

Build powinien zakończyć kompilację i wygenerować trasy Next.js.

## Aktualizacja: landing page + styl OpenAI + dokumenty prawne

Dodano publiczną stronę główną pod adresem `/` w stylu minimalistycznego panelu AI, z odnośnikami:

- `/botseller` - założenie własnego SalesBota i Stripe Checkout,
- `/client/login` - logowanie do panelu klienta,
- `/admin` - panel administratora,
- `/regulamin`, `/polityka-prywatnosci`, `/rodo`, `/cookies` - podstrony prawne.

Dodano również banner cookies, footer z legendą odnośników oraz odświeżony styl panelu admina, panelu klienta i formularza `/botseller`.

Build sprawdzisz komendą:

```sh
npm run build
```


## Aktualizacja: wersja naprawiona

Ta paczka zawiera poprawki opisane w pliku `FIXES_APPLIED.md`.

Najważniejsze: po płatności Stripe zamówienie można aktywować w panelu admina. Aktywacja tworzy konto klienta, kampanię, limity pakietu i dane logowania do panelu klienta. Dodano też bezpieczniejszy odczyt zamówień, walidację backendową formularza, obsługę GET dla Vercel Cron, lock równoległego runu kampanii, powiązanie Stripe z klientem oraz publiczny link rezygnacji `/unsubscribe`.

Po wdrożeniu uruchom ponownie cały plik `supabase/schema.sql`, ponieważ dodano nowe kolumny do `client_accounts`, `campaigns` i `signup_orders`.

## Aktualizacja: bezpieczeństwo automatycznej wysyłki

Wiadomości trafiają do `send_queue`, a worker przetwarza je zgodnie z godzinami pracy, strefą czasową i dziennym limitem kampanii. Warm-up korzysta z limitów zapisanych w ustawieniach kampanii/klienta. Przed follow-upem działa inbox checker; odpowiedzi, STOP, bounce, spam i wypisy trafiają na globalną listę blokad.

Najważniejsze ustawienia środowiska dla workera i bezpieczeństwa wysyłki:

```env
INBOX_CHECKER_ENABLED=true
INBOX_CHECKER_LOOKBACK_DAYS=14
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
SEND_WORKER_BATCH_SIZE=1
APP_MAX_DAILY_EMAILS=0
APP_MAX_MONTHLY_EMAILS=0
```

`SEND_WORKER_BATCH_SIZE` ma domyślnie wartość `1`. Wartość `0` dla globalnych limitów wyłącza dany limit. Harmonogram wysyłki ustawia się w konfiguracji kampanii.

Po wrzuceniu kodu odpal ponownie `supabase/schema.sql` i zrób redeploy w Vercel.
