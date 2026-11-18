// Device-local preferred entry currency, scoped to the authenticated account.
// This stores a currency CODE only; never store amounts, quotes, tokens or keys.
export const FX_CURRENCY_PREFERENCE_PREFIX="mh_finance_fx_currency_v1:";
const validOwner=userId=>typeof userId==="string"&&/^[A-Za-z0-9-]{8,128}$/.test(userId);
const validCode=code=>typeof code==="string"&&/^[A-Z]{3}$/.test(code);
export function readFxCurrencyPreference(userId,storage){
  if(!validOwner(userId))return "MYR";
  try{
    const code=storage?.getItem?.(FX_CURRENCY_PREFERENCE_PREFIX+userId);
    return validCode(code)?code:"MYR";
  }catch{return "MYR";}
}
export function writeFxCurrencyPreference(userId,currency,storage){
  if(!validOwner(userId)||!validCode(currency))return false;
  try{
    storage?.setItem?.(FX_CURRENCY_PREFERENCE_PREFIX+userId,currency);
    return true;
  }catch{return false;}
}
