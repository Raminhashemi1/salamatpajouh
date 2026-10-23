import test from "node:test";
import assert from "node:assert/strict";
import {SPLIT_FEATURE_DEFAULTS,validateSplitRecipients,snapshotSplitForDraft,allocateSplit,splitFeatureReady} from "./revenue-split.mjs";
const two=[{beneficiaryId:"owner_1",shareBps:6000},{beneficiaryId:"partner_2",shareBps:4000}];
const three=[{beneficiaryId:"owner_1",shareBps:5000},{beneficiaryId:"partner_2",shareBps:3000},{beneficiaryId:"guest_3",shareBps:2000}];
test("split and international settle disabled by default",()=>{
 assert.equal(SPLIT_FEATURE_DEFAULTS.enabled,false);
 assert.equal(SPLIT_FEATURE_DEFAULTS.directSettlementEnabled,false);
 assert.equal(SPLIT_FEATURE_DEFAULTS.internationalEnabled,false);
});
test("two partners can share 60/40",()=>{
 assert.deepEqual(allocateSplit(10000000,two).allocations.map(p=>p.amountMinor),[6000000,4000000]);
});
test("third party on selected order only 50/30/20",()=>{
 const s=snapshotSplitForDraft({orderId:"order_1",orderStatus:"draft",defaultRecipients:two,overrideRecipients:three,overrideReason:"guest instructor event 27",approvedBy:"admin_1"});
 assert.equal(s.source,"order_override");
 assert.deepEqual(allocateSplit(10000000,s.recipients).allocations.map(p=>p.amountMinor),[5000000,3000000,2000000]);
 assert.equal(two.length,2);
});
test("default ratio may change for future orders only",()=>{
 const first=snapshotSplitForDraft({orderId:"order_1",orderStatus:"draft",defaultRecipients:two});
 const changed=[{beneficiaryId:"owner_1",shareBps:7000},{beneficiaryId:"partner_2",shareBps:3000}];
 const next=snapshotSplitForDraft({orderId:"order_2",orderStatus:"draft",defaultRecipients:changed});
 assert.equal(first.recipients[0].shareBps,6000);
 assert.equal(next.recipients[0].shareBps,7000);
 assert.equal(Object.isFrozen(first.recipients),true);
});
test("no edits after checkout is opened",()=>{
 assert.throws(()=>snapshotSplitForDraft({orderId:"order_3",orderStatus:"pending",defaultRecipients:two}),/LOCKED/);
 assert.throws(()=>snapshotSplitForDraft({orderId:"order_3",orderStatus:"paid",defaultRecipients:two}),/LOCKED/);
});
test("order override requires authorized operator and reason",()=>{
 assert.throws(()=>snapshotSplitForDraft({orderId:"order_4",orderStatus:"draft",defaultRecipients:two,overrideRecipients:three}),/approvedBy/);
 assert.throws(()=>snapshotSplitForDraft({orderId:"order_4",orderStatus:"draft",defaultRecipients:two,overrideRecipients:three,approvedBy:"admin_1",overrideReason:"x"}),/JUSTIFICATION/);
});
test("percentages must equal exactly 100%",()=>{
 assert.throws(()=>validateSplitRecipients([{beneficiaryId:"owner_1",shareBps:6500},{beneficiaryId:"partner_2",shareBps:4000}]),/TOTAL_100/);
});
test("reject duplicate beneficiary and more than three",()=>{
 assert.throws(()=>validateSplitRecipients([{beneficiaryId:"owner_1",shareBps:5000},{beneficiaryId:"owner_1",shareBps:5000}]),/DUPLICATE/);
 assert.throws(()=>validateSplitRecipients([...three,{beneficiaryId:"other_4",shareBps:100}]),/TWO_OR_THREE/);
});
test("reject fractional or zero percentage shares",()=>{
 assert.throws(()=>validateSplitRecipients([{beneficiaryId:"owner_1",shareBps:5000.1},{beneficiaryId:"partner_2",shareBps:4999.9}]),/INVALID_SHARE/);
 assert.throws(()=>validateSplitRecipients([{beneficiaryId:"owner_1",shareBps:10000},{beneficiaryId:"partner_2",shareBps:0}]),/INVALID_SHARE/);
});
test("tiny IRR odd amounts are allocated exactly, with no lost rial",()=>{
 const r=allocateSplit(7,three);
 assert.equal(r.allocations.reduce((sum,x)=>sum+x.amountMinor,0),7);
 assert.deepEqual(r.allocations.map(x=>x.amountMinor),[4,2,1]);
});
test("allocations for one rial preserve total",()=>{
 assert.equal(allocateSplit(1,two).allocations.reduce((sum,x)=>sum+x.amountMinor,0),1);
});
test("zero distributable amount is valid after refund",()=>{
 assert.deepEqual(allocateSplit(0,two).allocations.map(x=>x.amountMinor),[0,0]);
});
test("invalid amounts fail closed",()=>{
 for(const a of [-1,0.01,Number.MAX_SAFE_INTEGER+1,NaN])assert.throws(()=>allocateSplit(a,two),RangeError);
});
test("settlement cannot activate without all trusted approvals",()=>{
 assert.equal(splitFeatureReady(),false);
 assert.equal(splitFeatureReady({featureEnabled:true}),false);
 assert.equal(splitFeatureReady({featureEnabled:true,providerSupportsSplit:true,beneficiariesVerified:true,commercialApproval:true,operatorAuthorized:true}),true);
});
