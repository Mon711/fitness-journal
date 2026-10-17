"use client";
import { useEffect, useState } from "react";
import {
  quoteDay,
  QUOTE_SOURCE,
  type DailyQuote as Quote,
} from "../lib/quotes";
export default function DailyQuote() {
  const [quote, setQuote] = useState<Quote | null>(null);
  useEffect(() => {
    let active = true,
      day = "",
      loadedDay = "",
      attemptedAt = 0,
      pending = false;
    async function refresh() {
      const currentDay = quoteDay();
      if (
        pending ||
        loadedDay === currentDay ||
        document.visibilityState === "hidden" ||
        (day === currentDay && Date.now() - attemptedAt < 15 * 60 * 1000)
      )
        return;
      if (day !== currentDay && active) setQuote(null);
      day = currentDay;
      attemptedAt = Date.now();
      pending = true;
      try {
        const response = await fetch("/api/quote", {
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { quote: Quote | null };
        if (data.quote?.day === currentDay) loadedDay = currentDay;
        if (active) setQuote(data.quote);
      } catch {
        /* The journal remains usable if the optional quote is unavailable. */
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  if (!quote) return null;
  return (
    <aside className="daily-quote" aria-label="Quote of the day">
      <p className="eyebrow">A THOUGHT FOR TODAY</p>
      <blockquote>
        <p>“{quote.text}”</p>
        <footer>— {quote.author}</footer>
      </blockquote>
      <a
        href={QUOTE_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
      >
        Quotes provided by ZenQuotes
      </a>
    </aside>
  );
}
