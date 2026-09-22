// Postgres `date`/`timestamptz` columns come back as "YYYY-MM-DD" or a full
// ISO timestamp. Parsed as a Date and reformatted with toLocaleDateString,
// a plain date string shifts a day depending on the browser's timezone
// (midnight UTC vs. local) -- so this reformats the string directly
// instead, which is also what keeps <input type="date"> (which requires
// "YYYY-MM-DD") working unaffected wherever it's used for editing.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}
