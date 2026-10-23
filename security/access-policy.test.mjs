import test from "node:test";
import assert from "node:assert/strict";
import {ROLES, ACTIONS, canPerform, requirePermission} from "./access-policy.mjs";

const owner = {authenticated:true,userId:"owner_1",role:ROLES.OWNER};
const editor = {authenticated:true,userId:"partner_2",role:ROLES.CONTENT_EDITOR};
const ownDraft = {authorUserId:"partner_2",status:"draft"};
const otherDraft = {authorUserId:"other_3",status:"draft"};
const ownLive = {authorUserId:"partner_2",status:"published"};
const statement = {recipientUserId:"partner_2",approved:true,released:true};

test("owner can review, publish, manage finance, accounts and release",()=>{
 for(const action of [ACTIONS.REVIEW_CONTENT,ACTIONS.PUBLISH_CONTENT,
 ACTIONS.MANAGE_FINANCIALS,ACTIONS.VIEW_ALL_FINANCIALS,ACTIONS.MANAGE_USERS,
 ACTIONS.RELEASE_SITE,ACTIONS.CONFIGURE_SECURITY])
 assert.equal(canPerform(owner,action),true);
});
test("editor can create a draft",()=>assert.equal(canPerform(editor,ACTIONS.CREATE_DRAFT),true));
test("editor may edit their own draft",()=>assert.equal(canPerform(editor,ACTIONS.EDIT_OWN_DRAFT,ownDraft),true));
test("editor may submit their own draft",()=>assert.equal(canPerform(editor,ACTIONS.SUBMIT_OWN_DRAFT,ownDraft),true));
test("editor may view their own draft",()=>assert.equal(canPerform(editor,ACTIONS.VIEW_OWN_DRAFT,ownDraft),true));
test("editor cannot edit someone else's draft",()=>assert.equal(canPerform(editor,ACTIONS.EDIT_OWN_DRAFT,otherDraft),false));
test("editor cannot edit published content",()=>assert.equal(canPerform(editor,ACTIONS.EDIT_OWN_DRAFT,ownLive),false));
test("editor cannot publish or review",()=>{
 assert.equal(canPerform(editor,ACTIONS.PUBLISH_CONTENT),false);
 assert.equal(canPerform(editor,ACTIONS.REVIEW_CONTENT),false);
});
test("editor cannot change payments or rates",()=>assert.equal(canPerform(editor,ACTIONS.MANAGE_FINANCIALS),false));
test("editor cannot deploy or manage users",()=>{
 assert.equal(canPerform(editor,ACTIONS.RELEASE_SITE),false);
 assert.equal(canPerform(editor,ACTIONS.MANAGE_USERS),false);
});
test("editor cannot export all finances",()=>assert.equal(canPerform(editor,ACTIONS.VIEW_ALL_FINANCIALS),false));
test("editor sees only approved released own statement",()=>{
 assert.equal(canPerform(editor,ACTIONS.VIEW_OWN_STATEMENT,statement),true);
 for(const change of [{recipientUserId:"owner_1"},{approved:false},{released:false}])
 assert.equal(canPerform(editor,ACTIONS.VIEW_OWN_STATEMENT,{...statement,...change}),false);
});
test("unknown actions are always denied",()=>assert.equal(canPerform(owner,"root:everything"),false));
test("disabled and unauthenticated principals are denied",()=>{
 for(const p of [{...owner,authenticated:false},{...editor,disabled:true},null,{}])
 assert.equal(canPerform(p,ACTIONS.CREATE_DRAFT),false);
});
test("browser-supplied roles cannot be trusted by caller: policy requires validated role",()=>{
 assert.equal(canPerform({...editor,role:"editor_admin"},ACTIONS.CREATE_DRAFT),false);
});
test("requirePermission returns 403 on unauthorized access",()=>{
 assert.throws(()=>requirePermission(editor,ACTIONS.MANAGE_USERS),err=>err.status===403 && err.code==="FORBIDDEN");
});
