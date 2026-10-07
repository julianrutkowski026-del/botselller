"use client";

import Link from "next/link";

import BotSellerLogo from "@/components/brand/BotSellerLogo";
import { useLanguage } from "@/components/i18n/LanguageContext";

export default function MarketingFooter() {
  const { language } = useLanguage();
  const copy = language === "pl"
    ? {
        tagline: "Prospecting B2B, wiadomości sprzedażowe i panel klienta.",
        description: "FluxBase BotSeller pomaga wyszukiwać firmy, przygotowywać kampanie i obsługiwać odpowiedzi w jednym miejscu.",
        product: "Produkt",
        home: "Strona główna",
        deployment: "Wdrożenie dla partnera",
        start: "Wybierz pakiet SalesBot",
        login: "Zaloguj się do panelu",
        documents: "Dokumenty",
        terms: "Regulamin",
        privacy: "Polityka prywatności",
        rodo: "Informacja RODO",
        cookies: "Polityka cookies",
        portals: "Panele",
        clientPanel: "Panel klienta",
        clientLogin: "Logowanie klienta",
        adminPanel: "Panel administratora",
      }
    : {
        tagline: "B2B prospecting, sales messages and a client panel.",
        description: "FluxBase BotSeller helps find companies, prepare campaigns and manage replies in one place.",
        product: "Product",
        home: "Homepage",
        deployment: "Partner deployment",
        start: "Choose a SalesBot plan",
        login: "Log in to the panel",
        documents: "Documents",
        terms: "Terms of service",
        privacy: "Privacy policy",
        rodo: "GDPR information",
        cookies: "Cookie policy",
        portals: "Panels",
        clientPanel: "Client panel",
        clientLogin: "Client login",
        adminPanel: "Admin panel",
      };

  return (
    <footer className="marketing-footer">
      <div className="footer-brand">
        <div className="footer-logo-row">
          <BotSellerLogo variant="header" />
          <span>{copy.tagline}</span>
        </div>
        <p>{copy.description}</p>
      </div>

      <div className="footer-links-grid">
        <div>
          <h3>{copy.product}</h3>
          <Link href="/">{copy.home}</Link>
          <Link href="/#wdrozenia">{copy.deployment}</Link>
          <Link href="/botseller">{copy.start}</Link>
          <Link href="/client/login">{copy.login}</Link>
        </div>
        <div>
          <h3>{copy.documents}</h3>
          <Link href="/regulamin">{copy.terms}</Link>
          <Link href="/polityka-prywatnosci">{copy.privacy}</Link>
          <Link href="/rodo">{copy.rodo}</Link>
          <Link href="/cookies">{copy.cookies}</Link>
        </div>
        <div>
          <h3>{copy.portals}</h3>
          <Link href="/client">{copy.clientPanel}</Link>
          <Link href="/client/login">{copy.clientLogin}</Link>
          <Link href="/admin">{copy.adminPanel}</Link>
        </div>
      </div>
    </footer>
  );
}
