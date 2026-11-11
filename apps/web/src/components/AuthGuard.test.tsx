import { render, screen, waitFor } from '@testing-library/react';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
var mockStore: jest.Mock;
const mockSetUser = jest.fn();
const mockLogout = jest.fn();
const mockState = {
  token: null as string | null,
  setUser: mockSetUser,
  logout: mockLogout,
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/dashboard/agents',
}));

jest.mock('@/store/auth', () => {
  mockStore = jest.fn() as jest.Mock & { persist: { hasHydrated: jest.Mock; onFinishHydration: jest.Mock } };
  Object.assign(mockStore, {
    persist: {
      hasHydrated: jest.fn(() => true),
      onFinishHydration: jest.fn(() => jest.fn()),
    },
  });
  return { useAuthStore: mockStore };
});
jest.mock('@/lib/api/auth', () => ({ authApi: { me: jest.fn() } }));
jest.mock('@/lib/api/client', () => ({ api: { get: jest.fn() } }));

import { AuthGuard, CompanyGuard } from './AuthGuard';
import { authApi } from '@/lib/api/auth';

const mockUser = {
  id: 'user-1', email: 'operator@example.com', username: 'operator',
  first_name: 'Alex', last_name: 'Operator', is_active: true,
  is_superuser: true, created_at: '', updated_at: '',
};

describe('AuthGuard (Zero-Authentication Operator Guard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.token = null;
    mockStore.mockImplementation((selector?: (state: typeof mockState) => unknown) =>
      selector ? selector(mockState) : mockState,
    );
  });

  it('always renders children immediately without redirecting to /auth/login even when token is null', async () => {
    jest.mocked(authApi.me).mockResolvedValue(mockUser);
    render(<AuthGuard><div>Protected dashboard</div></AuthGuard>);

    expect(screen.getByText('Protected dashboard')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(mockUser));
  });

  it('continues rendering children without redirecting even if authApi.me fails', async () => {
    jest.mocked(authApi.me).mockRejectedValue(new Error('Backend unavailable'));
    render(<CompanyGuard><div>Offline-resilient dashboard</div></CompanyGuard>);

    expect(screen.getByText('Offline-resilient dashboard')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
