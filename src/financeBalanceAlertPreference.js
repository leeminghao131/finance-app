// Local UI preference ONLY. It never reads/writes the Supabase database,
// finance calculations or the legacy shared balance-alert key.
// The old shared key is deliberately left untouched: its owner is unknown,
// so migrating it automatically could disclose another account's preference.
export const DEFAULT_FINANCE_BALANCE_ALERT="1500";
const PREFIX="finance-balance-limit-v4-account:";

export function normalizedFinanceBalanceAlert(value) {
  const raw=String(value??"").trim();
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw))return null;
  const amount=Number(raw);
  if(!Number.isFinite(amount)||amount>1000000000000)return null;
  return raw;
}

export function financeBalanceAlertKey(userId) {
  if(typeof userId!=="string"||!userId.trim())return null;
  return PREFIX+encodeURIComponent(userId);
}

export function readFinanceBalanceAlert(userId,storage) {
  const key=financeBalanceAlertKey(userId);
  if(!key||!storage)return DEFAULT_FINANCE_BALANCE_ALERT;
  try{
    return normalizedFinanceBalanceAlert(storage.getItem(key))||
      DEFAULT_FINANCE_BALANCE_ALERT;
  }catch{
    return DEFAULT_FINANCE_BALANCE_ALERT;
  }
}

export function saveFinanceBalanceAlert(userId,value,storage) {
  const key=financeBalanceAlertKey(userId);
  const normalized=normalizedFinanceBalanceAlert(value);
  if(!key||!storage||normalized===null)return false;
  try{storage.setItem(key,normalized);return true;}catch{return false;}
}
