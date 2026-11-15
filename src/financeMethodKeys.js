/**
 * Presentation-only aliases for the four built-in payment method keys.
 * Old translated <option> elements without an explicit value could accidentally
 * save their translated label (e.g. "银行账户") instead of BANK.
 * Custom Method names are preserved verbatim; never rewrite historic rows.
 */
const builtin=Object.freeze({
  "BANK":"BANK","银行账户":"BANK","银行转账":"BANK",
  "BANK IN":"BANK","ONLINE BANK IN":"BANK","DEBIT CARD":"BANK",
  "CASH":"CASH","现金":"CASH",
  "TNG":"TNG","TNG 电子钱包":"TNG",
  "GRAB PAY":"GRAB PAY","GrabPay":"GRAB PAY","GRAB PAY 电子钱包":"GRAB PAY",
});
export function canonicalFinanceMethod(value){
  const raw=String(value??"").trim();
  return Object.hasOwn(builtin,raw)?builtin[raw]:raw;
}
export function canonicalFinanceMethodList(options=[]){
  return [...new Set(options.map(canonicalFinanceMethod).filter(Boolean))];
}
