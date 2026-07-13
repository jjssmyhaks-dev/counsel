/**
 * WorkOS client — enterprise SSO, directory sync, and user management.
 *
 * WorkOS allows legal and consulting firms to sign in with their
 * existing identity provider (Okta, Azure AD, Google Workspace, etc.)
 * via SAML or OIDC — a requirement for B2B enterprise sales.
 *
 * SDK version: 10.7.0
 */

import { WorkOS as WorkOSClient } from '@workos-inc/node';

const WORKOS_API_KEY = process.env.WORKOS_API_KEY || '';
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID || '';

export const workos = new WorkOSClient(WORKOS_API_KEY);
export const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/callback';

// ── Helper types ────────────────────────────────────────────────────────────

export interface WorkOSProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  idpId?: string;
}

// ── SAML/OIDC SSO ───────────────────────────────────────────────────────────

export async function getAuthorizationUrl(
  connectionId: string,
  state?: string,
): Promise<string> {
  const { code, url } = await workos.sso.getAuthorizationUrl({
    clientId: WORKOS_CLIENT_ID,
    redirectUri: WORKOS_REDIRECT_URI,
    connection: connectionId,
    state: state || undefined,
  });
  return url;
}

export async function authenticateWithCode(
  code: string,
): Promise<WorkOSProfile> {
  const { profile } = await workos.sso.authenticate({
    clientId: WORKOS_CLIENT_ID,
    code,
  });

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName ?? undefined,
    lastName: profile.lastName ?? undefined,
    organizationId: profile.organizationId ?? undefined,
    idpId: profile.idpId,
  };
}

// ── Organization management ─────────────────────────────────────────────────

export async function createOrganization(
  name: string,
  domains: string[],
): Promise<{ id: string; name: string }> {
  const org = await workos.organizations.createOrganization({
    name,
    domainData: domains.map((d) => ({ domain: d })),
  } as any);
  return { id: org.id, name: org.name };
}

export async function getOrganization(organizationId: string) {
  return workos.organizations.getOrganization(organizationId);
}

export async function listOrganizations() {
  const { data } = await workos.organizations.listOrganizations();
  return data;
}

// ── Directory Sync (SCIM) ───────────────────────────────────────────────────

export async function getDirectory(directoryId: string) {
  return workos.directorySync.getDirectory(directoryId);
}

export async function listDirectories(organizationId?: string) {
  const { data } = await workos.directorySync.listDirectories({
    organizationId,
  } as any);
  return data;
}

export async function listDirectoryUsers(directoryId: string, limit = 100) {
  const { data } = await workos.directorySync.listUsers({
    directory: directoryId,
  });
  return data.slice(0, limit);
}

export async function listDirectoryGroups(directoryId: string) {
  const { data } = await workos.directorySync.listGroups({
    directory: directoryId,
  });
  return data;
}

// ── User Management ─────────────────────────────────────────────────────────

export async function createUser(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}) {
  const user = await workos.userManagement.createUser({
    email: params.email,
    firstName: params.firstName ?? '',
    lastName: params.lastName ?? '',
    emailVerified: params.emailVerified ?? true,
  });
  return user;
}

export async function getUser(userId: string) {
  return workos.userManagement.getUser(userId);
}

export async function listUsers(organizationId?: string) {
  const { data } = await workos.userManagement.listUsers({
    organizationId,
  });
  return data;
}

export async function deleteUser(userId: string) {
  return workos.userManagement.deleteUser(userId);
}
