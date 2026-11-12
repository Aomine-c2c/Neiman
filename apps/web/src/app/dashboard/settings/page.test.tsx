import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminSettingsPage from './page';
import { ThemeProvider } from '@/components/ThemeProvider';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { logout: () => void }) => unknown) => selector({ logout: jest.fn() }),
}));

jest.mock('@/lib/organizationContext', () => ({
  useAccountContext: () => ({ user: { email: 'operator@neiman.ai' } }),
  useOrganizationContext: () => ({ id: 'co-1', name: 'NEIMAN', industry: 'Software', mission: 'Ship', status: 'ACTIVE' }),
}));

jest.mock('@/lib/authPreview', () => ({
  isDevelopmentAuthBypassEnabled: () => false,
}));

jest.mock('@/components/desktop/DesktopStatusCard', () => ({
  DesktopStatusCard: () => <div data-testid="desktop-status-card" />,
}));

jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ openai_configured: false, anthropic_configured: false, gemini_configured: false, ollama_host: '' }),
    patch: jest.fn(),
  },
}));

jest.mock('@/lib/api/systemUpdates', () => ({
  systemConfigApi: { resetSetup: jest.fn() },
}));

const CATEGORIES = [
  'AI Providers & Model Routing',
  'MCP Servers & Tool Integrations',
  'Governance & Safety Gates',
  'Compute, Budgets & Token Quotas',
  'Repository & Workspace General',
];

describe('AdminSettingsPage (Stage 9 — Settings & Models)', () => {
  it('renders the 5 canonical vertical settings category tabs', () => {
    render(<AdminSettingsPage />);
    const nav = screen.getByRole('tablist', { name: /Settings categories/i });
    expect(nav).toHaveAttribute('aria-orientation', 'vertical');
    const tabs = within(nav).getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    CATEGORIES.forEach((label, i) => {
      expect(tabs[i]).toHaveTextContent(label);
    });
  });

  it('defaults to AI Providers & Model Routing and switches category sub-sections on click', () => {
    render(<AdminSettingsPage />);
    const nav = screen.getByRole('tablist', { name: /Settings categories/i });

    const aiTab = within(nav).getByRole('tab', { name: /AI Providers & Model Routing/i });
    expect(aiTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 2, name: /AI Providers/i })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole('tab', { name: /Compute, Budgets & Token Quotas/i }));
    expect(screen.getByRole('heading', { level: 2, name: /Resources/i })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole('tab', { name: /Governance & Safety Gates/i }));
    expect(screen.getByRole('heading', { level: 2, name: /Policies/i })).toBeInTheDocument();
    // Sub-section pills scoped to the active category
    expect(screen.getByRole('button', { name: /Audit Logs/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Appearance$/i })).not.toBeInTheDocument();
  });

  it('navigates to Appearance section and renders Dark Mode / Light Mode theme selectors', () => {
    render(
      <ThemeProvider>
        <AdminSettingsPage />
      </ThemeProvider>
    );
    const nav = screen.getByRole('tablist', { name: /Settings categories/i });

    // Click Repository & Workspace General tab
    fireEvent.click(within(nav).getByRole('tab', { name: /Repository & Workspace General/i }));

    // Click Appearance subsection
    const appearanceBtn = screen.getByRole('button', { name: /Appearance/i });
    fireEvent.click(appearanceBtn);

    // Verify theme selector options
    expect(screen.getByText(/OPERATIONAL THEME SELECTION/i)).toBeInTheDocument();
    expect(screen.getByText('Light Mode')).toBeInTheDocument();
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByText('System Sync')).toBeInTheDocument();

    // Click Dark Mode card
    const darkModeBtn = screen.getByRole('button', { name: /Dark Mode Sleek Obsidian/i });
    fireEvent.click(darkModeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

