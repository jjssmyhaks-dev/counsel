/**
 * WorkOS client — enterprise SSO, directory sync, and user management.
 *
 * Lazy-initialized: the WorkOS client is only created when the API key
 * and client ID are available from environment variables.
 */

import type { WorkOS as WorkOSType } from '@workos-inc/node';

let _workos: WorkOSType | null = null;
let WORKOS_CLIENT_ID = '';
let WORKOS_REDIRECT_URI = '';

export function initWorkOS() {
  if (_workos) return;

  const { WorkOS } = require('@workos-inc/node');
  const apiKey = process.env.WORKOS_API_KEY || '';
  const clientId = process.env.WORKOS_CLIENT_ID || '';

  if (!apiKey && !clientId) {
    throw new Error('WORKOS_API_KEY or WORKOS_CLIENT_ID required');
  }

  _workos = apiKey
    ? new WorkOS(apiKey)
    : new WorkOS({ clientId });
  WORKOS_CLIENT_ID = clientId;
  WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/callback';
}

export function getWorkOS(): WorkOSType {
  if (!_workos) initWorkOS();
  return _workos!;
}

export function getWorkOSClientId() {
  if (!_workos) initWorkOS();
  return WORKOS_CLIENT_ID;
}

export function getWorkOSRedirectUri() {
  if (!_workos) initWorkOS();
  return WORKOS_REDIRECT_URI;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorkOSProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  idpId?: string;
}

// ── SAML/OIDC SSO ───────────────────────────────────────────────────────────

export async function getAuthorizationUrl(connectionId: string, state?: string) {
  const workos = getWorkOS();
  const { url } = await workos.sso.getAuthorizationUrl({
    connection: connectionId,
    clientId: getWorkOSClientId(),
    redirectUri: getWorkOSRedirectUri(),
    state: state || undefined,
  });
  return url;
}

export async function authenticateWithCode(code: string): Promise<WorkOSProfile> {
  const workos = getWorkOS();
  const { profile } = await workos.sso.authenticate({
    clientId: getWorkOSClientId(),
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

export async function createOrganization(name: string, domains: string[]) {
  const workos = getWorkOS();
  const org = await workos.organizations.createOrganization({
    name,
    domainData: domains.map((d) => ({ domain: d })),
  } as any);
  return { id: org.id, name: org.name };
}

export async function getOrganization(organizationId: string) {
  return getWorkOS().organizations.getOrganization(organizationId);
}

export async function listOrganizations() {
  const { data } = await getWorkOS().organizations.listOrganizations();
  return data;
}

// ── Directory Sync (SCIM) ───────────────────────────────────────────────────

export async function getDirectory(directoryId: string) {
  return getWorkOS().directorySync.getDirectory(directoryId);
}

export async function listDirectories(organizationId?: string) {
  const { data } = await getWorkOS().directorySync.listDirectories({
    organizationId,
  } as any);
  return data;
}

export async function listDirectoryUsers(directoryId: string, limit = 100) {
  const { data } = await getWorkOS().directorySync.listUsers({ directory: directoryId });
  return data.slice(0, limit);
}

export async function listDirectoryGroups(directoryId: string) {
  const { data } = await getWorkOS().directorySync.listGroups({ directory: directoryId });
  return data;
}

// ── User Management ─────────────────────────────────────────────────────────

export async function createWorkOSUser(params: {
  email: string; firstName?: string; lastName?: string; emailVerified?: boolean;
}) {
  return getWorkOS().userManagement.createUser({
    email: params.email,
    firstName: params.firstName ?? '',
    lastName: params.lastName ?? '',
    emailVerified: params.emailVerified ?? true,
  });
}

export async function getWorkOSUser(userId: string) {
  return getWorkOS().userManagement.getUser(userId);
}

export async function listWorkOSUsers(organizationId?: string) {
  const { data } = await getWorkOS().userManagement.listUsers({ organizationId });
  return data;
}

export async function deleteWorkOSUser(userId: string) {
  return getWorkOS().userManagement.deleteUser(userId);
}
