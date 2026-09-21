/**
 * api.js - the only module that talks to the network.
 *
 * Responsibilities (Technical Spec section 3):
 * - wrap fetch, add common headers, parse JSON, normalise errors.
 * - no DOM work happens in this file.
 */

const BASE_URL = '/api';

/** Error type every caller can rely on, whatever went wrong. */
export class ApiError extends Error {
  constructor(message, { code = 'INTERNAL_ERROR', status = 0, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** True when the user needs to sign in before retrying. */
  get isAuthError() {
    return this.status === 401 || this.code === 'UNAUTHENTICATED';
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const options = {
    method,
    signal,
    headers: { Accept: 'application/json' },
    // Sessions are cookie based; keep credentials on every call.
    credentials: 'same-origin',
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch (cause) {
    // Offline, DNS failure, server not running.
    throw new ApiError('Could not reach the server. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
      details: cause?.message,
    });
  }

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message ?? 'The request failed. Please try again.', {
      code: error?.code ?? 'INTERNAL_ERROR',
      status: response.status,
      details: error?.details,
    });
  }

  return payload;
}

/** GET returning { data, meta }. */
export function get(path, options) {
  return request(path, { ...options, method: 'GET' });
}

export function post(path, body, options) {
  return request(path, { ...options, method: 'POST', body });
}

export function patch(path, body, options) {
  return request(path, { ...options, method: 'PATCH', body });
}

export function del(path, options) {
  return request(path, { ...options, method: 'DELETE' });
}

/* --- Endpoint helpers -------------------------------------------------- */

/**
 * Load the catalogue.
 * @param {{ kind?: 'food' | 'place' }} [options]
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function fetchSpots({ kind } = {}) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const payload = await get(`/spots${query}`);
  return { items: payload?.data ?? [], meta: payload?.meta ?? {} };
}

/** Load one spot by id. */
export async function fetchSpot(id) {
  const payload = await get(`/spots/${encodeURIComponent(id)}`);
  return payload?.data ?? null;
}
