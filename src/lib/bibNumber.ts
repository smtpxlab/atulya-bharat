// Deterministic 6-digit bib number from a registration id.
// Stable across reloads, no DB write needed. Format: ABR-NNNNNN.
export function bibNumberFromRegistrationId(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0;
  }
  const six = String(Math.abs(hash) % 1_000_000).padStart(6, "0");
  return `ABR-${six}`;
}
