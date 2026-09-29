import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
export function normalizePhone(raw: string): string | null {
  let input=raw.trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632)));
  if (!/^[+\d\s().-]+$/.test(input)) return null;
  if(input.startsWith('00')) input='+'+input.slice(2);
  if(!input.startsWith('+')) input='+'+input;
  const phone=parsePhoneNumberFromString(input);
  return phone?.isValid()?phone.number.slice(1):null;
}

export function normalizePhones(values: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizePhone(value);
    if (!normalized) {
      if (value.trim()) invalid.push(value.trim());
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      valid.push(normalized);
    }
  }
  return { valid, invalid };
}
