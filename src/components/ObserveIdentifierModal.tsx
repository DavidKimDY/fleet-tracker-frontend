import { FormEvent, useEffect, useState } from 'react';
import { isValidIdentifier } from '../lib/cookies';

type Props = {
  open: boolean;
  initialValue: string;
  required?: boolean;
  onClose: () => void;
  onSubmit: (identifier: string) => void;
};

export function ObserveIdentifierModal({
  open,
  initialValue,
  required = false,
  onClose,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  if (!open) return null;

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
    onSubmit(value);
  }

  function handleBackdropClick() {
    if (!required) onClose();
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="observe-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id="observe-modal-title" className="modal__title">
            관찰 차량 식별자
          </h2>
          {!required && (
            <button
              type="button"
              className="modal__close"
              aria-label="닫기"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </header>
        <form className="modal__form" onSubmit={handleSubmit}>
          <p className="modal__desc">
            대시보드에 표시할 차량의 식별자를 입력하세요.
          </p>
          <label htmlFor="observe-id" className="modal__label">
            VEHICLE ID
          </label>
          <input
            id="observe-id"
            className={`modal__input${error ? ' modal__input--error' : ''}`}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          {error && (
            <p className="modal__error" role="alert">
              {error}
            </p>
          )}
          <div className="modal__actions">
            {!required && (
              <button
                type="button"
                className="modal__btn modal__btn--ghost"
                onClick={onClose}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="modal__btn modal__btn--primary"
              disabled={!!error}
            >
              적용
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
