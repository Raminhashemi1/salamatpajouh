/**
 * Net-revenue accounting before optional sharing among two/three beneficiaries.
 * Amounts in smallest currency units: domestic IRR is always integer rials.
 * This is a pure calculation ONLY; authorization, source verification, ledgers
 * and settlement are responsibilities of an authenticated server.
 */
import {allocateSplit} from "./revenue-split.mjs";

export const APPROVABLE_COST_TYPES=Object.freeze([
 "gateway_fee","customer_refund","statutory_deduction","approved_direct_cost","other_documented_cost"
]);
function safeMoney(value,label,{allowZero=true}={}){
 if(!Number.isSafeInteger(value)||value<0||(!allowZero&&value===0))throw new RangeError("INVALID_"+label);
}
function validRef(value,label){
 if(typeof value!=="string"||value.trim().length<3||value.length>160)throw new TypeError("INVALID_"+label);
}
/**
 * Gross is the original captured receipt; if refunds are already excluded
 * from gross, do NOT subtract them again. All deduction records must be
 * server-verified AND preapproved according to the parties' written contract.
 */
export function calculateNetRevenue({grossAmountMinor,deductions=[]}){
 safeMoney(grossAmountMinor,"GROSS_AMOUNT");
 if(!Array.isArray(deductions))throw new TypeError("INVALID_DEDUCTIONS");
 const accepted=[],seen=new Set();
 let total=0n;
 for(const entry of deductions){
  if(!entry||typeof entry!=="object")throw new TypeError("INVALID_DEDUCTION");
  validRef(entry.id,"DEDUCTION_ID");
  if(seen.has(entry.id))throw new Error("DUPLICATE_DEDUCTION");
  seen.add(entry.id);
  if(!APPROVABLE_COST_TYPES.includes(entry.type))throw new RangeError("UNSUPPORTED_COST_TYPE");
  safeMoney(entry.amountMinor,"COST_AMOUNT",{allowZero:false});
  if(entry.approved!==true||entry.verified!==true)throw new Error("UNAPPROVED_OR_UNVERIFIED_COST");
  validRef(entry.approvalReference,"APPROVAL_REFERENCE");
  validRef(entry.evidenceReference,"EVIDENCE_REFERENCE");
  const copy=Object.freeze({id:entry.id,type:entry.type,amountMinor:entry.amountMinor,
    approvalReference:entry.approvalReference,evidenceReference:entry.evidenceReference});
  accepted.push(copy);
  total+=BigInt(entry.amountMinor);
 }
 const gross=BigInt(grossAmountMinor);
 if(total>gross)throw new RangeError("COSTS_EXCEED_GROSS_REVENUE");
 return Object.freeze({
  basis:"net_after_approved_costs",
  grossAmountMinor,
  deductionTotalMinor:Number(total),
  netAmountMinor:Number(gross-total),
  deductions:Object.freeze(accepted)
 });
}
export function allocateNetRevenue({grossAmountMinor,deductions=[],recipients}){
 const net=calculateNetRevenue({grossAmountMinor,deductions});
 const allocated=allocateSplit(net.netAmountMinor,recipients);
 if(allocated.allocations.reduce((sum,r)=>sum+BigInt(r.amountMinor),0n)!==BigInt(net.netAmountMinor))
   throw new Error("ALLOCATION_MISMATCH");
 return Object.freeze({...net,allocations:allocated.allocations,
  note:"Allocation report only; no payout or gateway action"});
}
