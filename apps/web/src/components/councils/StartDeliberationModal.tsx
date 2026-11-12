'use client';

import React, { useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';

interface StartDeliberationModalProps {
  open: boolean;
  title: string;
  problem: string;
  isSubmitting: boolean;
  canMutate: boolean;
  onChangeTitle: (val: string) => void;
  onChangeProblem: (val: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function StartDeliberationModal({
  open,
  title,
  problem,
  isSubmitting,
  canMutate,
  onChangeTitle,
  onChangeProblem,
  onClose,
  onSubmit,
}: StartDeliberationModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    titleInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-delib-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id="start-delib-title" className="text-base font-bold text-foreground">
            Start Architecture Deliberation
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-7 min-w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="delib-topic-input" className="block text-xs font-medium text-foreground mb-1">
              Topic / Decision Title
            </label>
            <input
              id="delib-topic-input"
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="e.g. Event-Driven Billing Microservice Split"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="delib-problem-input" className="block text-xs font-medium text-foreground mb-1">
              Architectural Problem Statement &amp; Constraints
            </label>
            <textarea
              id="delib-problem-input"
              rows={4}
              value={problem}
              onChange={(e) => onChangeProblem(e.target.value)}
              placeholder="Describe the engineering trade-offs, performance constraints, or security concerns for the Council to evaluate…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-8 px-3.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canMutate || isSubmitting}
            className="min-h-8 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            <span>Convene Council</span>
          </button>
        </div>
      </div>
    </div>
  );
}
