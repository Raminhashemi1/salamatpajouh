import test from "node:test";
import assert from "node:assert/strict";
import {calculateNetRevenue,allocateNetRevenue} from "./net-revenue.mjs";
const two=[{beneficiaryId:"owner_1",shareBps:6000},{beneficiaryId:"partner_2",shareBps:4000}];
function item(id,type,amountMinor){return {id,type,amountMinor,approved:true,verified:true,approvalReference:"agreement_1",evidenceReference:"invoice_1"};}
test("net revenue deducts only validated costs in rials",()=>{
 const result=allocateNetRevenue({grossAmountMinor:10000000,
 deductions:[item("fee_1","gateway_fee",200000),item("course_1","approved_direct_cost",800000)],recipients:two});
 assert.equal(result.netAmountMinor,9000000);
 assert.equal(result.deductionTotalMinor,1000000);
 assert.deepEqual(result.allocations.map(x=>x.amountMinor),[5400000,3600000]);
});
test("refund is subtracted from captured gross once",()=>{
 assert.equal(calculateNetRevenue({grossAmountMinor:1000,deductions:[item("refund_1","customer_refund",200)]}).netAmountMinor,800);
});
test("withheld tax can be a documented deduction",()=>{
 assert.equal(calculateNetRevenue({grossAmountMinor:1000,deductions:[item("tax_1","statutory_deduction",100)]}).netAmountMinor,900);
});
test("no costs keeps the gross amount",()=>assert.equal(calculateNetRevenue({grossAmountMinor:7000}).netAmountMinor,7000));
test("exactly matching costs leave zero to share",()=>{
 const result=allocateNetRevenue({grossAmountMinor:500,deductions:[item("refund_1","customer_refund",500)],recipients:two});
 assert.deepEqual(result.allocations.map(x=>x.amountMinor),[0,0]);
});
test("costs over income are not silently clipped",()=>{
 assert.throws(()=>calculateNetRevenue({grossAmountMinor:100,deductions:[item("fee_1","gateway_fee",101)]}),/COSTS_EXCEED/);
});
test("fractional/negative/unbounded costs reject",()=>{
 for(const amountMinor of [-1,0,1.5,Number.MAX_SAFE_INTEGER+1])
 assert.throws(()=>calculateNetRevenue({grossAmountMinor:1000,deductions:[item("fee_1","gateway_fee",amountMinor)]}),RangeError);
});
test("refuse unapproved or unverified costs",()=>{
 assert.throws(()=>calculateNetRevenue({grossAmountMinor:1000,deductions:[{...item("fee_1","gateway_fee",100),approved:false}]}),/UNAPPROVED/);
 assert.throws(()=>calculateNetRevenue({grossAmountMinor:1000,deductions:[{...item("fee_1","gateway_fee",100),verified:false}]}),/UNAPPROVED/);
});
test("require evidence and approval references",()=>{
 assert.throws(()=>calculateNetRevenue({grossAmountMinor:1000,deductions:[{...item("fee_1","gateway_fee",100),evidenceReference:""}]}),/EVIDENCE_REFERENCE/);
 assert.throws(()=>calculateNetRevenue({grossAmountMinor:1000,deductions:[{...item("fee_1","gateway_fee",100),approvalReference:""}]}),/APPROVAL_REFERENCE/);
});
test("same expense cannot be deducted twice by ID",()=>assert.throws(()=>calculateNetRevenue({grossAmountMinor:1000,deductions:[item("fee_1","gateway_fee",100),item("fee_1","gateway_fee",100)]}),/DUPLICATE/));
test("unrecognized expense category rejected",()=>assert.throws(()=>calculateNetRevenue({grossAmountMinor:1000,deductions:[item("x_1","anything",50)]}),/UNSUPPORTED/));
test("three recipients use net income not gross",()=>{
 const beneficiaries=[{beneficiaryId:"owner_1",shareBps:5000},{beneficiaryId:"partner_2",shareBps:3000},{beneficiaryId:"guest_3",shareBps:2000}];
 const result=allocateNetRevenue({grossAmountMinor:1000,deductions:[item("cost_1","approved_direct_cost",100)],recipients:beneficiaries});
 assert.deepEqual(result.allocations.map(x=>x.amountMinor),[450,270,180]);
});
test("odd remainder preserved exactly without fractional rials",()=>{
 const result=allocateNetRevenue({grossAmountMinor:101,deductions:[item("fee_1","gateway_fee",1)],recipients:two});
 assert.equal(result.allocations.reduce((sum,x)=>sum+x.amountMinor,0),100);
});
test("all outputs are frozen reports, not transfers",()=>{
 const r=allocateNetRevenue({grossAmountMinor:100,recipients:two});
 assert.equal(r.note.includes("no payout"),true);
 assert.equal(Object.isFrozen(r.allocations),true);
});
