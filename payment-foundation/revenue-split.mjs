/**
 * Optional revenue-sharing policy for SalamatPajouh.
 * No bank API calls, payouts or account numbers are handled by this module.
 * Plan percentages use basis points (10000 = 100%).
 * Beneficiary IDs must refer to backend-verified beneficiaries, never bank details.
 */
export const SPLIT_FEATURE_DEFAULTS=Object.freeze({
 enabled:false,directSettlementEnabled:false,internationalEnabled:false
});
const idPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;
function requireId(value,label){
 if(typeof value!=="string"||!idPattern.test(value))throw new TypeError(label+" is invalid");
}
function requireAmount(value,label,allowZero=false){
 if(!Number.isSafeInteger(value)||value<0||(!allowZero&&value===0))throw new RangeError(label+" must be a safe integer in minor currency units");
}
/** Allow exactly two permanent partners or a third beneficiary for individual orders. */
export function validateSplitRecipients(recipients){
 if(!Array.isArray(recipients)||![2,3].includes(recipients.length))throw new RangeError("TWO_OR_THREE_BENEFICIARIES_REQUIRED");
 const seen=new Set();
 const copy=recipients.map((item)=>{
   if(!item||typeof item!=="object")throw new TypeError("Invalid beneficiary");
   requireId(item.beneficiaryId,"beneficiaryId");
   if(seen.has(item.beneficiaryId))throw new Error("DUPLICATE_BENEFICIARY");
   seen.add(item.beneficiaryId);
   if(!Number.isSafeInteger(item.shareBps)||item.shareBps<1||item.shareBps>10000)throw new RangeError("INVALID_SHARE_BPS");
   return Object.freeze({beneficiaryId:item.beneficiaryId,shareBps:item.shareBps});
 });
 if(copy.reduce((sum,item)=>sum+item.shareBps,0)!==10000)throw new RangeError("PERCENTAGES_MUST_TOTAL_100");
 return Object.freeze(copy);
}
/**
 * Capture an immutable per-order split plan before payment is requested.
 * Later edits to the default plan do not retroactively change this snapshot.
 * overrides require a trusted admin approval and written reason.
 */
export function snapshotSplitForDraft({orderId,orderStatus,defaultRecipients,overrideRecipients=null,overrideReason="",approvedBy=""}){
 requireId(orderId,"orderId");
 if(orderStatus!=="draft")throw new Error("SPLIT_PLAN_LOCKED_AFTER_CHECKOUT");
 const isOverride=overrideRecipients!==null;
 const recipients=validateSplitRecipients(isOverride?overrideRecipients:defaultRecipients);
 if(isOverride){
   requireId(approvedBy,"approvedBy");
   if(typeof overrideReason!=="string"||overrideReason.trim().length<5||overrideReason.trim().length>500)
     throw new Error("OVERRIDE_REQUIRES_JUSTIFICATION");
 }
 return Object.freeze({
   orderId,source:isOverride?"order_override":"default",
   recipients,approvedBy:isOverride?approvedBy:null,
   reason:isOverride?overrideReason.trim():null
 });
}
/**
 * Allocate an authorized distributable amount (after the chosen fee/tax/refund
 * policy is applied on the trusted server). Uses integer largest remainder
 * rounding: the recipient amounts sum EXACTLY to amountMinor.
 */
export function allocateSplit(amountMinor,recipients){
 requireAmount(amountMinor,"amountMinor",true);
 const plan=validateSplitRecipients(recipients),denominator=10000n,amount=BigInt(amountMinor);
 const shares=plan.map((p)=>({
   ...p,whole:(amount*BigInt(p.shareBps))/denominator,
   remainder:(amount*BigInt(p.shareBps))%denominator
 }));
 let allocated=shares.reduce((sum,p)=>sum+p.whole,0n);
 const sortIndices=shares.map((_,index)=>index).sort((a,b)=>{
   const diff=shares[b].remainder-shares[a].remainder;
   return diff!==0n?(diff>0n?1:-1):shares[a].beneficiaryId.localeCompare(shares[b].beneficiaryId,"en");
 });
 let index=0;
 while(allocated<amount){shares[sortIndices[index]].whole+=1n;allocated+=1n;index++;}
 const result=shares.map(p=>Object.freeze({
   beneficiaryId:p.beneficiaryId,shareBps:p.shareBps,amountMinor:Number(p.whole)
 }));
 return Object.freeze({amountMinor,allocations:Object.freeze(result)});
}
/**
 * Configuration safety gate ONLY. All flags and beneficiary verifications must
 * be loaded on the server. Actual settlement requires an approved provider
 * adapter and authenticated/verified payment; this module NEVER sends money.
 */
export function splitFeatureReady({
 featureEnabled=false,providerSupportsSplit=false,beneficiariesVerified=false,
 commercialApproval=false,operatorAuthorized=false
}={}){
 return featureEnabled===true&&providerSupportsSplit===true&&
        beneficiariesVerified===true&&commercialApproval===true&&operatorAuthorized===true;
}
