import type { ReactNode } from 'react';

export function describedBy(id: string, help?: ReactNode, error?: string | null): string | undefined {
  return [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
}

/** Move focus to the first field marked invalid after a failed submit. */
export function focusFirstInvalid(form: HTMLElement | null) {
  requestAnimationFrame(() => {
    const target = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
  });
}
