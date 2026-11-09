'use client';

import React, { useState, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { BashTerminal } from './BashTerminal';

export function GlobalTerminalDrawer() {
  const { activeCompany } = useAuthStore();
  const companyId = activeCompany?.id || '';

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Global hotkey listener: Ctrl + ` (backtick) or Ctrl + Shift + ` or Alt + T
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl + ` (backtick) or Alt + T
      if ((e.ctrlKey && e.key === '`') || (e.altKey && e.key.toLowerCase() === 't')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen && !isMaximized) {
        // Optional dismiss with Escape if no input focused
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, isMaximized]);

  // Expose toggle event for header or sidebar buttons
  useEffect(() => {
    const handleToggleEvent = () => setIsOpen((prev) => !prev);
    window.addEventListener('neiman:toggle-terminal', handleToggleEvent);
    return () => window.removeEventListener('neiman:toggle-terminal', handleToggleEvent);
  }, []);

  if (!isOpen || !companyId) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Global Terminal Dock"
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-200 animate-slide-up shadow-2xl ${
        isMaximized
          ? 'top-12 h-[calc(100vh-3rem)]'
          : 'h-[360px] sm:h-[420px]'
      }`}
    >
      <div className="h-full w-full bg-zinc-950/95 backdrop-blur-md border-t-2 border-primary/60 flex flex-col">
        <BashTerminal
          companyId={companyId}
          className="h-full border-none rounded-none"
          isMaximized={isMaximized}
          onToggleMaximize={() => setIsMaximized((prev) => !prev)}
          onClose={() => setIsOpen(false)}
        />
      </div>
    </div>
  );
}
