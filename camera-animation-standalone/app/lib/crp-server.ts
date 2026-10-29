import 'server-only';

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';

const AUTH_URL = 'https://authentication.dev.learningpadedu.com/user/login';
const REFRESH_URL = 'https://authentication.dev.learningpadedu.com/user/refresh/access/token';
const MODELS_URL = 'https://content.dev.learningpadedu.com/v2/crp/models';

type Session = { accessToken?: string; refreshToken?: string };
const session: Session = {};

const findString = (value: unknown, keys: string[]): string | undefined => {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findString(child, keys);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'string' && record[key]) return record[key] as string;
    }
    for (const child of Object.values(record)) {
      const found = findString(child, keys);
      if (found) return found;
    }
  }
  return undefined;
};

const parseEnv = (source: string) => {
  const values: Record<string, string> = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([^=]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1].trim()] = value;
  }
  return values;
};

const loadCredentials = async () => {
  const configuredPath = process.env.CRP_ENV_FILE;
  const envPath = configuredPath
    ? path.resolve(configuredPath)
    : path.resolve(process.cwd(), '.env');
  const fileValues = parseEnv(await readFile(envPath, 'utf8'));
  const username = process.env.CRP_USERNAME || fileValues.CRP_USERNAME;
  const password = process.env.CRP_PASSWORD || fileValues.CRP_PASSWORD;
  const role = process.env.CRP_ROLE || fileValues.CRP_ROLE || 'internal';
  if (!username || !password) {
    throw new Error(`CRP credentials are missing. Set CRP_ENV_FILE or CRP_USERNAME/CRP_PASSWORD.`);
  }
  return { username, password, role };
};

const authenticate = async (credentials?: { username: string; password: string; role?: string }) => {
  const { username, password, role } = credentials || await loadCredentials();
  const passwordHash = /^[a-f\d]{64}$/i.test(password)
    ? password
    : createHash('sha256').update(password).digest('hex');
  const body = new URLSearchParams({ username, password: passwordHash, role });
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`CRP login failed (${response.status}).`);
  const payload = await response.json();
  session.accessToken = findString(payload, ['access_token', 'accessToken', 'token']);
  session.refreshToken = findString(payload, ['refresh_token', 'refreshToken']);
  if (!session.accessToken) throw new Error('CRP login returned no access token.');
};

export const loginWithCredentials = async (credentials: {
  username: string;
  password: string;
  role?: string;
}) => {
  if (!credentials.username.trim() || !credentials.password) {
    throw new Error('Username and password are required.');
  }
  await authenticate({
    username: credentials.username.trim(),
    password: credentials.password,
    role: credentials.role?.trim() || 'internal',
  });
};

const refresh = async () => {
  if (!session.refreshToken) return authenticate();
  const response = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.refreshToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
    cache: 'no-store',
  });
  if (!response.ok) return authenticate();
  const payload = await response.json();
  session.accessToken = findString(payload, ['access_token', 'accessToken', 'token']);
  session.refreshToken = findString(payload, ['refresh_token', 'refreshToken']) || session.refreshToken;
  if (!session.accessToken) throw new Error('CRP refresh returned no access token.');
};

export const crpRequest = async (url: string, init: RequestInit = {}) => {
  if (!session.accessToken) await authenticate();
  const request = () => fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: 'no-store',
  });
  let response = await request();
  if (response.status === 401) {
    await refresh();
    response = await request();
  }
  if (!response.ok) throw new Error(`CRP request failed (${response.status}).`);
  return response.json();
};

export const searchModels = async (search: string) => {
  const query = new URLSearchParams({ search, page: '1', limit: '100' });
  return crpRequest(`${MODELS_URL}?${query}`);
};

export const findExactModel = async (fileName: string) => {
  for (let page = 1; page <= 100; page += 1) {
    const query = new URLSearchParams({ search: fileName, page: String(page), limit: '100' });
    const payload = await crpRequest(`${MODELS_URL}?${query}`);
    const data = payload?.data;
    const models = Array.isArray(data)
      ? data
      : Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data?.items) ? data.items : [];
    const exact = models.find((model: any) =>
      String(model?.file_name || '').toLocaleLowerCase() === fileName.toLocaleLowerCase());
    if (exact) return exact;
    const pagination = payload?.pagination || {};
    if (!models.length || pagination.has_next === false ||
        (Number.isInteger(pagination.total_pages) && page >= pagination.total_pages)) break;
    if (!payload?.pagination && models.length === 100) {
      throw new Error('CRP search did not return pagination information.');
    }
  }
  return null;
};

export const getModel = async (modelId: string) => crpRequest(`${MODELS_URL}/get`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model_id: modelId }),
});

