'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface CockpitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  categoryTag?: string;
  categoryColor?: string;
  fullPageHref?: string;
  children: React.ReactNode;
  widthClass?: string;
}

export function CockpitDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  categoryTag,
  categoryColor = 'text-primary',
  fullPageHref,
  children,
  widthClass = 'max-w-4xl',
}: CockpitDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Accessible Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsMaximized(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/40 backdrop-blur-xs transition-opacity duration-200 select-none"
      aria-modal="true"
      role="dialog"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className={`relative flex h-full w-full ${
          isMaximized ? 'max-w-[96vw]' : widthClass
        } flex-col border-l border-border bg-card shadow-2xl transition-all duration-150 ease-out animate-in fade-in`}
      >
        {/* Flat Industrial Docked Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 font-mono bg-secondary/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {categoryTag && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${categoryColor}`}>
                    [{categoryTag}]
                  </span>
                )}
                <h2 className="text-xs font-bold tracking-tight text-foreground uppercase truncate">
                  {title}
                </h2>
              </div>
              {subtitle && (
                <p className="text-[10px] font-sans text-muted-foreground truncate max-w-md">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Action Pills */}
          <div className="flex items-center gap-1 bg-background p-0.5 rounded border border-border shrink-0">
            {fullPageHref && (
              <Link
                href={fullPageHref}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                title="Open as Standalone Page"
                onClick={onClose}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
              title={isMaximized ? 'Restore Split-Screen' : 'Maximize Console'}
              aria-label="Toggle modal expansion"
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all"
              aria-label="Close modal (Escape)"
              title="Close (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Content Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 select-text">
          {children}
        </div>
      </div>
    </div>
  );
}
