import { getIdentifierFromCookie, isValidIdentifier } from './cookies';

const STORAGE_KEY = 'fleet_tracker_observe_id';

export function getObservedIdentifier(): string | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && isValidIdentifier(stored)) return stored;
  } catch {
    /* private mode */
  }
  return getIdentifierFromCookie();
}

export function setObservedIdentifier(identifier: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, identifier);
  } catch {
    /* ignore */
  }
}
