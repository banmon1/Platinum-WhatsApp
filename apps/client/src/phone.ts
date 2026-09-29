import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
export function normalizeRecipient(raw:string,country:CountryCode='JO'):string|null {
  let input=raw.trim().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632)));
  if (!/^[+\d\s().-]+$/.test(input)) return null;
  if(input.startsWith('00')) input='+'+input.slice(2);
  const phone=parsePhoneNumberFromString(input,country);
  return phone?.isValid()?phone.number:null;
}
