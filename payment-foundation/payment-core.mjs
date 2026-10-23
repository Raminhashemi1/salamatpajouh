/**
 * SalamatPajouh billing-domain reference implementation (NOT a live payment server).
 * IRR amounts are whole rials. USD/EUR amounts are cents, never converted from IRR.
 * All data passed here must come from trusted server records; client claims are untrusted.
 */
export const DISCOUNTS=Object.freeze({NEW_SELF_DECLARED:10,RENEWAL:30});
export const CURRENCIES=Object.freeze({
 IRR:Object.freeze({unit:"rial",route:"domestic"}),
 USD:Object.freeze({unit:"cent",route:"international"}),
 EUR:Object.freeze({unit:"cent",route:"international"})
});
function moneyInteger(value,label){
 if(!Number.isSafeInteger(value)||value<=0) throw new RangeError(label+" must be a positive safe integer");
}
export function approvedTariffFor(catalog,currency,year){
 if(!Object.hasOwn(CURRENCIES,currency)) throw new RangeError("UNSUPPORTED_CURRENCY");
 if(!Number.isSafeInteger(year)||!Array.isArray(catalog)) throw new TypeError("Invalid year or catalog");
 const row=catalog.find(t=>t.currency===currency&&t.persianYear===year&&t.status==="approved");
 if(!row) throw new Error("TARIFF_NOT_APPROVED");
 moneyInteger(row.annualAmountMinor,"tariff");
 return Object.freeze({currency,persianYear:year,annualAmountMinor:row.annualAmountMinor});
}
function discountedInteger(amount,percent){
 const result=(BigInt(amount)*BigInt(100-percent)+50n)/100n;
 if(result<=0n||result>BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Amount out of range");
 return Number(result);
}
export function createQuote({currency,annualAmountMinor,member=null,targetGroupDeclared=false,now=new Date()}){
 if(!Object.hasOwn(CURRENCIES,currency)) throw new RangeError("UNSUPPORTED_CURRENCY");
 moneyInteger(annualAmountMinor,"annual amount");
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())) throw new TypeError("Invalid now");
 const expiry=member?.expiresAt==null?null:new Date(member.expiresAt);
 if(expiry&&!Number.isFinite(expiry.getTime())) throw new TypeError("Invalid expiry");
 if(expiry&&expiry.getTime()>now.getTime()) return Object.freeze({eligible:false,reason:"ACTIVE_MEMBERSHIP",currency,kind:"none",discountPercent:0,amountMinor:0});
 const kind=expiry?"renewal":"new";
 const discountPercent=expiry?DISCOUNTS.RENEWAL:(targetGroupDeclared===true?DISCOUNTS.NEW_SELF_DECLARED:0);
 return Object.freeze({eligible:true,reason:null,currency,kind,discountPercent,amountMinor:discountedInteger(annualAmountMinor,discountPercent),annualAmountMinor});
}
/** Legacy v0.9 was a demonstration only; migrate a trusted tariff once, not on every render. */
export function legacyTomanToRial(toman){
 moneyInteger(toman,"toman");
 const result=BigInt(toman)*10n;
 if(result>BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Rial overflow");
 return Number(result);
}
export function formatCurrency(amountMinor,currency,locale="fa-IR"){
 if(!Object.hasOwn(CURRENCIES,currency)) throw new RangeError("UNSUPPORTED_CURRENCY");
 if(!Number.isSafeInteger(amountMinor)||amountMinor<0) throw new RangeError("Invalid amount");
 if(currency==="IRR")return amountMinor.toLocaleString(locale)+" ریال";
 return (amountMinor/100).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})+" "+currency;
}
/** Feature flags and provider allowlist are configured by the operator on the server. */
export function chooseRoute(currency,configuredRoutes){
 if(!Object.hasOwn(CURRENCIES,currency))throw new RangeError("UNSUPPORTED_CURRENCY");
 const family=CURRENCIES[currency].route,route=configuredRoutes?.[family];
 if(!route||route.enabled!==true||!route.provider||!route.currencyAllowlist?.includes(currency))
  throw new Error("PAYMENTS_NOT_CONFIGURED");
 return Object.freeze({family,provider:route.provider,currency});
}
/** Only pass a trusted provider verification response, never the browser callback data. */
export function verifiedPaymentMatches(order,verified){
 if(!order||order.status!=="pending"||!verified||verified.verified!==true)return false;
 if(order.provider!==verified.provider||order.currency!==verified.currency)return false;
 if(!order.authority||order.authority!==verified.authority)return false;
 if(!Number.isSafeInteger(order.amountMinor)||order.amountMinor<=0||verified.amountMinor!==order.amountMinor)return false;
 if(typeof verified.reference!=="string"||verified.reference.trim().length<4)return false;
 return true;
}
export function canTransition(from,to){
 const allowed={draft:["pending","cancelled"],pending:["paid","failed","cancelled"],paid:[],failed:[],cancelled:[]};
 return allowed[from]?.includes(to)===true;
}
