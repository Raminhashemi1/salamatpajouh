/**
 * Salamatpajouh: server-side authorization policy (NOT wired to production).
 * Principals and role assignments MUST be supplied by a trusted authenticated
 * server session. Never trust role, userId or resource ownership from the browser.
 */
export const ROLES = Object.freeze({
  OWNER: "owner",
  CONTENT_EDITOR: "content_editor"
});

export const ACTIONS = Object.freeze({
  CREATE_DRAFT: "content:create_draft",
  EDIT_OWN_DRAFT: "content:edit_own_draft",
  SUBMIT_OWN_DRAFT: "content:submit_own_draft",
  VIEW_OWN_DRAFT: "content:view_own_draft",
  REVIEW_CONTENT: "content:review",
  PUBLISH_CONTENT: "content:publish",
  MANAGE_CONTENT: "content:manage",
  MANAGE_USERS: "users:manage",
  MANAGE_FINANCIALS: "finance:manage",
  VIEW_ALL_FINANCIALS: "finance:view_all",
  VIEW_OWN_STATEMENT: "finance:view_own_approved_statement",
  RELEASE_SITE: "deployment:release",
  CONFIGURE_SECURITY: "security:configure"
});

const ALL_ACTIONS = new Set(Object.values(ACTIONS));
const EDITOR_ACTIONS = new Set([
  ACTIONS.CREATE_DRAFT,
  ACTIONS.EDIT_OWN_DRAFT,
  ACTIONS.SUBMIT_OWN_DRAFT,
  ACTIONS.VIEW_OWN_DRAFT,
  ACTIONS.VIEW_OWN_STATEMENT
]);

function trustedPrincipal(principal) {
  return principal && principal.authenticated === true &&
    principal.disabled !== true &&
    typeof principal.userId === "string" &&
    principal.userId.trim().length > 0 &&
    Object.values(ROLES).includes(principal.role);
}

/**
 * Authorization decision only. Controllers must call this on every API request,
 * load resource metadata from the database, then scope SQL queries to userId.
 * Access to user, publication, banking and deployment secrets is owner-only.
 */
export function canPerform(principal, action, resource = null) {
  if (!trustedPrincipal(principal) || !ALL_ACTIONS.has(action)) return false;
  if (principal.role === ROLES.OWNER) return true;
  if (principal.role !== ROLES.CONTENT_EDITOR || !EDITOR_ACTIONS.has(action)) return false;
  if (action === ACTIONS.CREATE_DRAFT) return resource == null;
  if (action === ACTIONS.VIEW_OWN_STATEMENT) {
    return resource?.recipientUserId === principal.userId &&
      resource?.approved === true && resource?.released === true;
  }
  // Editors can only view, edit or submit their own UNPUBLISHED drafts.
  return resource?.authorUserId === principal.userId &&
    resource?.status === "draft";
}

export function requirePermission(principal, action, resource = null) {
  if (!canPerform(principal, action, resource)) {
    const error = new Error("FORBIDDEN");
    error.code = "FORBIDDEN";
    error.status = 403;
    throw error;
  }
  return true;
}
