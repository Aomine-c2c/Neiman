import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GitManagementPage from './page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vcsApi } from '@/lib/api/vcs';
import { useAuthStore } from '@/store/auth';

const mockCompany = {
  id: 'c1',
  name: 'Neiman Software Org',
};

jest.mock('@/lib/api/vcs', () => ({
  vcsApi: {
    getStatus: jest.fn().mockResolvedValue({
      branch: 'main',
      upstream: 'origin/main',
      ahead: 1,
      behind: 0,
      is_clean: false,
      staged_files: [
        {
          path: 'apps/api/nexora/domains/vcs/service.py',
          status: 'M',
          staged: true,
          additions: 120,
          deletions: 10,
        },
      ],
      unstaged_files: [
        {
          path: 'apps/web/src/lib/api/vcs.ts',
          status: 'M',
          staged: false,
          additions: 45,
          deletions: 2,
        },
      ],
      untracked_files: ['tests/new_feature.ts'],
      stashes_count: 1,
    }),
    getBranches: jest.fn().mockResolvedValue({
      current_branch: 'main',
      branches: [
        {
          name: 'main',
          is_current: true,
          is_remote: false,
          upstream: 'origin/main',
          last_commit_sha: '59e3cc8',
          last_commit_message: 'feat: add git code management',
          last_commit_author: 'NEIMAN Operator',
          last_commit_date: '2026-11-09 09:08:52',
        },
        {
          name: 'feature/vcs-staging',
          is_current: false,
          is_remote: false,
          upstream: null,
          last_commit_sha: '3e06db1',
          last_commit_message: 'wip: staging',
          last_commit_author: 'Devine General',
          last_commit_date: '2026-11-08 12:00:00',
        },
      ],
    }),
    getCommitLog: jest.fn().mockResolvedValue({
      commits: [
        {
          sha: '59e3cc8c1d0da7d46d37dd3cbf4a28387c310b64',
          short_sha: '59e3cc8',
          author: 'NEIMAN Operator',
          email: 'operator@neiman.ai',
          date: '2026-11-09 09:08:52',
          message: 'feat: add git code management',
          parent_shas: ['3e06db1'],
          graph_symbol: '*',
        },
      ],
      total_commits: 1,
      current_branch: 'main',
    }),
    getStashes: jest.fn().mockResolvedValue({
      stashes: [
        {
          index: 0,
          selector: 'stash@{0}',
          sha: 'a1b2c3d',
          message: 'WIP on vcs branch',
          date: '2026-11-09 08:00:00',
        },
      ],
      total: 1,
    }),
    checkConflicts: jest.fn().mockResolvedValue({
      has_conflicts: false,
      conflicted_files: [],
    }),
    getDiff: jest.fn().mockResolvedValue({
      diff: 'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@\n+added line\n',
      files_changed: 1,
      additions: 1,
      deletions: 0,
      target_file: null,
      staged: false,
    }),
    stageFiles: jest.fn().mockResolvedValue({}),
    unstageFiles: jest.fn().mockResolvedValue({}),
    discardFiles: jest.fn().mockResolvedValue({}),
    createCommit: jest.fn().mockResolvedValue({
      sha: 'new-sha',
      short_sha: 'new-sha',
      branch: 'main',
      message: 'feat: commit test',
      author: 'Operator',
      timestamp: '2026-11-09',
      files_committed: 1,
    }),
    createBranch: jest.fn().mockResolvedValue({}),
    checkoutBranch: jest.fn().mockResolvedValue({}),
    createStash: jest.fn().mockResolvedValue({}),
    popStash: jest.fn().mockResolvedValue({}),
    dropStash: jest.fn().mockResolvedValue({}),
    getRemotes: jest.fn().mockResolvedValue({
      remotes: [
        {
          name: 'origin',
          url: 'https://github.com/Aomine-c2c/Sila.git',
          is_official: false,
          is_private: true,
        },
        {
          name: 'official',
          url: 'https://github.com/Aomine-c2c/Neiman.git',
          is_official: true,
          is_private: false,
        },
      ],
      official_configured: true,
      official_url: 'https://github.com/Aomine-c2c/Neiman.git',
    }),
    syncRelease: jest.fn().mockResolvedValue({
      success: true,
      target_remote: 'official',
      remote_url: 'https://github.com/Aomine-c2c/Neiman.git',
      source_branch: 'main',
      target_branch: 'main',
      release_tag: 'v0.2.0',
      commit_sha: '59e3cc8c1d0da7d46d37dd3cbf4a28387c310b64',
      short_sha: '59e3cc8',
      dry_run: true,
      message: 'Preflight checks passed cleanly.',
      preflight_checks: [
        { check: 'Two-Repository Topology', status: 'PASSED', details: 'official -> Neiman.git' },
        { check: 'Secret Scrubbing', status: 'PASSED', details: 'Air-gap verified.' },
      ],
    }),
  },
}));

describe('GitManagementPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAuthStore.getState().setActiveCompany(mockCompany as any);
    jest.clearAllMocks();
  });

  it('renders repository top bar, staging console, and commit log', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GitManagementPage />
      </QueryClientProvider>
    );

    // Header
    expect(screen.getByText('Git Code Management')).toBeInTheDocument();
    expect(screen.getByText('NEIMAN VCS Engine')).toBeInTheDocument();

    // Staged Changes
    await waitFor(() => {
      expect(screen.getByText(/Staged Changes \(1\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText('apps/api/nexora/domains/vcs/service.py')).toBeInTheDocument();

    // Unstaged & Untracked Changes
    expect(screen.getByText(/Changes \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('apps/web/src/lib/api/vcs.ts')).toBeInTheDocument();
    expect(screen.getByText('tests/new_feature.ts')).toBeInTheDocument();

    // Commit Composer
    expect(screen.getByPlaceholderText(/Commit message \(e\.g\./i)).toBeInTheDocument();
    expect(screen.getByText(/Co-authored by NEIMAN Autonomous Agent/i)).toBeInTheDocument();
  });

  it('applies conventional commit prefix when clicking prefix chips', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GitManagementPage />
      </QueryClientProvider>
    );

    const textarea = screen.getByPlaceholderText(/Commit message \(e\.g\./i);
    const featButton = screen.getByRole('button', { name: /^feat$/i });

    fireEvent.click(featButton);
    expect(textarea).toHaveValue('feat: ');

    const fixButton = screen.getByRole('button', { name: /^fix$/i });
    fireEvent.click(fixButton);
    expect(textarea).toHaveValue('fix: ');
  });

  it('submits commit when message is populated and staged files exist', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GitManagementPage />
      </QueryClientProvider>
    );

    const textarea = screen.getByPlaceholderText(/Commit message \(e\.g\./i);
    fireEvent.change(textarea, { target: { value: 'feat(vcs): implement git staging' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Commit to main/i })).toBeEnabled();
    });

    const commitButton = screen.getByRole('button', { name: /Commit to main/i });
    fireEvent.click(commitButton);

    await waitFor(() => {
      expect(vcsApi.createCommit).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          message: expect.stringContaining('feat(vcs): implement git staging'),
        })
      );
    });
  });

  it('switches tabs between Commit Log, Stashes, and Conflicts', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GitManagementPage />
      </QueryClientProvider>
    );

    // Stashes Tab
    const stashesTab = screen.getByRole('button', { name: /Stashes/i });
    fireEvent.click(stashesTab);

    await waitFor(() => {
      expect(screen.getByText(/Push Working Tree to Stash/i)).toBeInTheDocument();
    });

    // Conflicts Tab
    const conflictsTab = screen.getByRole('button', { name: /Conflicts/i });
    fireEvent.click(conflictsTab);

    await waitFor(() => {
      expect(screen.getByText(/Zero Merge Conflicts/i)).toBeInTheDocument();
    });
  });

  it('renders Two-Repository architecture banner and opens Official Release Promotion modal', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <GitManagementPage />
      </QueryClientProvider>
    );

    // Two-Repository setup banner
    await waitFor(() => {
      expect(screen.getByText(/Private Development Remote \(origin\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Official Production Release Remote \(official\)/i)).toBeInTheDocument();
      expect(screen.getByText('https://github.com/Aomine-c2c/Neiman.git')).toBeInTheDocument();
    });

    // Click Promote Release
    const promoteButton = screen.getByRole('button', { name: /Promote Release/i });
    fireEvent.click(promoteButton);

    await waitFor(() => {
      expect(screen.getByText(/Promote Release to Official Repository/i)).toBeInTheDocument();
      expect(screen.getByText(/Preflight Dry-Run Simulation \(Recommended\)/i)).toBeInTheDocument();
    });

    // Trigger Pre-flight release promotion
    const runAuditButton = screen.getByRole('button', { name: /Run Pre-flight Audit/i });
    fireEvent.click(runAuditButton);

    await waitFor(() => {
      expect(vcsApi.syncRelease).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          target_remote: 'official',
          remote_url: 'https://github.com/Aomine-c2c/Neiman.git',
          dry_run: true,
        })
      );
    });

    // Verify preflight result rendered
    await waitFor(() => {
      expect(screen.getByText(/Preflight checks passed cleanly/i)).toBeInTheDocument();
      expect(screen.getByText('Two-Repository Topology')).toBeInTheDocument();
    });
  });
});
