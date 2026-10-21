export function currentMonthRange(
  now = new Date(),
  timeZone = "Europe/Bucharest",
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(last).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      month: "long",
      year: "numeric",
    }).format(now),
  };
}
