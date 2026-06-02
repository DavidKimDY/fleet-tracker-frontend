import { COOKIE_MAX_AGE_DAYS, COOKIE_NAME } from '../config';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9]+$/;

export function isValidIdentifier(value: string): boolean {
  return value.length >= 1 && IDENTIFIER_PATTERN.test(value);
}

export function getIdentifierFromCookie(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split('=').slice(1).join('='));
  return isValidIdentifier(value) ? value : null;
}

export function setIdentifierCookie(identifier: string): void {
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(identifier)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearIdentifierCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
