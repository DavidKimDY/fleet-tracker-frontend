import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getIdentifierFromCookie,
  isValidIdentifier,
  setIdentifierCookie,
} from '../lib/cookies';
import { generateIdentifier } from '../lib/identifier';

export function IdentifierPage() {
  const navigate = useNavigate();
  const existing = getIdentifierFromCookie();
  const [value, setValue] = useState(
    () => existing ?? generateIdentifier(12)
  );
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setValue(next);
    if (next.length === 0) {
      setError('식별자는 1자 이상이어야 합니다.');
    } else if (!isValidIdentifier(next)) {
      setError('영문 대·소문자와 숫자만 사용할 수 있습니다.');
    } else {
      setError(null);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidIdentifier(value)) {
      setError('유효한 식별자를 입력하세요.');
      return;
    }
    setIdentifierCookie(value);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="identifier-page">
      <div className="identifier-page__card">
        <h1 className="identifier-page__title">Fleet Tracker</h1>
        <p className="identifier-page__desc">
          텔레메트리 수집을 위한 차량 식별자를 확인하거나 수정하세요.
        </p>
        <form className="identifier-page__form" onSubmit={handleSubmit}>
          <label htmlFor="fleet-id" className="identifier-page__label">
            ID_KEY
          </label>
          <input
            id="fleet-id"
            className={`identifier-page__input${error ? ' identifier-page__input--error' : ''}`}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <p className="identifier-page__error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="identifier-page__submit"
            disabled={!!error}
          >
            ENTER DASHBOARD
          </button>
        </form>
      </div>
    </div>
  );
}
