import { useState, useEffect } from "react";

interface LiveClockData {
  dayName: string;
  hijriDate: string;
  gregorianDate: string;
  timeString: string;
  period: string;
  hours: number;
}

/**
 * Hook that returns live clock data updating every second.
 * Supports 12h format with صباحًا/مساءً.
 * All outputs in ar-SA locale with tabular-nums compatible formatting.
 */
export const useLiveClock = (use24h = false): LiveClockData => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  let timeString: string;
  let period = "";

  if (use24h) {
    timeString = `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
  } else {
    const h12 = hours % 12 || 12;
    period = hours < 12 ? "صباحًا" : "مساءً";
    timeString = `${String(h12).padStart(2, "0")}:${minutes}:${seconds}`;
  }

  const dayName = now.toLocaleDateString("ar-SA", { weekday: "long" });

  const hijriDate = now.toLocaleDateString("ar-SA-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const gregorianDate = now.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return { dayName, hijriDate, gregorianDate, timeString, period, hours };
};
