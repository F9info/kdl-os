import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '../../rtl/utils';
import userEvent from '@testing-library/user-event';
import UsersPage from '@/app/admin/users/page';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '@/lib/axios';

const baseUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@kdl.com',
  role: 'USER',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('UsersPage regression — SUPER_ADMIN role option gating (KDL-20 H4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function setupStore(role: string) {
    useAuthStore.setState({
      user: { ...baseUser, id: 'current', role: role as any },
      accessToken: 'access-token',
      isAuthenticated: true,
      isLoading: false,
    });
  }

  function mockUsers() {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { users: [baseUser], pagination: { total: 1, pages: 1 } } },
    } as any);
  }

  async function openRoleSelect(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit test user/i }));

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    const comboboxes = screen.getAllByRole('combobox');
    const roleSelect = comboboxes[comboboxes.length - 1]!;
    await user.click(roleSelect);

    return screen.getByRole('listbox');
  }

  it('hides SUPER_ADMIN role option for non-super admin users', async () => {
    const user = userEvent.setup();
    setupStore('ADMIN');
    mockUsers();
    render(<UsersPage />);

    const listbox = await openRoleSelect(user);

    expect(within(listbox).queryByText('Super Admin')).not.toBeInTheDocument();
    expect(within(listbox).getByText('User')).toBeInTheDocument();
    expect(within(listbox).getByText('Admin')).toBeInTheDocument();
  });

  it('shows SUPER_ADMIN role option for super admin users', async () => {
    const user = userEvent.setup();
    setupStore('SUPER_ADMIN');
    mockUsers();
    render(<UsersPage />);

    const listbox = await openRoleSelect(user);

    await waitFor(() => {
      expect(within(listbox).getByText('Super Admin')).toBeInTheDocument();
    });
  });
});
