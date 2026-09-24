// Vendored verbatim. Do not edit; bump upstream and re-copy.
export function leftPad(str, len, ch = " ") {
  str = String(str);
  while (str.length < len) str = ch + str;
  return str;
}
