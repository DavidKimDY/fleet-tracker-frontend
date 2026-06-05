import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getIdentifierFromCookie,
  isValidIdentifier,
  setIdentifierCookie,
} from '../lib/cookies';
import { generateIdentifier } from '../lib/identifier';
import { setObservedIdentifier } from '../lib/observe';

type Destination = '/dashboard' | '/fleet';

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

  function goTo(destination: Destination) {
    if (!isValidIdentifier(value)) {
      setError('유효한 식별자를 입력하세요.');
      return;
    }
    setIdentifierCookie(value);
    if (destination === '/dashboard') {
      setObservedIdentifier(value);
    }
    navigate(destination, { replace: true });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    goTo('/dashboard');
  }

  return (
    <div className="identifier-page">
      <div className="identifier-page__card">
        <h1 className="identifier-page__title">Fleet Tracker</h1>
        <p className="identifier-page__desc">
          차량 식별자를 입력한 뒤, GPS를 전송할지 대시보드에서 관찰할지
          선택하세요.
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
          <div className="identifier-page__actions">
            <button
              type="button"
              className="identifier-page__btn identifier-page__btn--fleet"
              disabled={!!error}
              onClick={() => goTo('/fleet')}
            >
              차량 클라이언트 - GPS 전송
            </button>
            <button
              type="submit"
              className="identifier-page__btn identifier-page__btn--dashboard"
              disabled={!!error}
            >
              관제 클라이언트 - 트래킹
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
