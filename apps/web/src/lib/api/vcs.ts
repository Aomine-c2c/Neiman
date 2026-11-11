/**
 * NEIMAN Git VCS API Client
 * Enterprise-grade Git code management: status, staging, branches, commits,
 * unified diffs, visual commit DAG logs, stashes, and conflict checking.
 */

import { api } from './client';

export interface GitFileChangeStatus {
  path: string;
  status: string; // "M", "A", "D", "R", "??"
  staged: boolean;
  additions: number;
  deletions: number;
}

export interface GitStatusResponse {
  branch: string;
  upstream?: string | null;
  ahead: number;
  behind: number;
  is_clean: boolean;
  staged_files: GitFileChangeStatus[];
  unstaged_files: GitFileChangeStatus[];
  untracked_files: string[];
  stashes_count: number;
}

export interface GitBranchItem {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream?: string | null;
  last_commit_sha?: string | null;
  last_commit_message?: string | null;
  last_commit_author?: string | null;
  last_commit_date?: string | null;
}

export interface GitBranchesResponse {
  current_branch: string;
  branches: GitBranchItem[];
}

export interface CreateBranchRequest {
  branch_name: string;
  checkout?: boolean;
  start_point?: string;
}

export interface CheckoutBranchRequest {
  branch_name: string;
  create_if_missing?: boolean;
}

export interface StageFilesRequest {
  paths?: string[];
  stage_all?: boolean;
}

export interface UnstageFilesRequest {
  paths?: string[];
  unstage_all?: boolean;
}

export interface DiscardFilesRequest {
  paths?: string[];
  discard_all?: boolean;
}

export interface CreateCommitRequest {
  message: string;
  author_name?: string;
  author_email?: string;
  amend?: boolean;
}

export interface CommitResult {
  sha: string;
  short_sha: string;
  branch: string;
  message: string;
  author: string;
  timestamp: string;
  files_committed: number;
}

export interface GitCommitLogItem {
  sha: string;
  short_sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
  parent_shas: string[];
  graph_symbol: string;
}

export interface GitCommitLogResponse {
  commits: GitCommitLogItem[];
  total_commits: number;
  current_branch: string;
}

export interface GitDiffResponse {
  diff: string;
  files_changed: number;
  additions: number;
  deletions: number;
  target_file?: string | null;
  staged: boolean;
}

export interface GitStashItem {
  index: number;
  selector: string;
  sha: string;
  message: string;
  date: string;
}

export interface GitStashListResponse {
  stashes: GitStashItem[];
  total: number;
}

export interface CreateStashRequest {
  message?: string;
  include_untracked?: boolean;
}

export interface ConflictFileItem {
  path: string;
  conflict_markers_count: number;
}

export interface ConflictCheckResponse {
  has_conflicts: boolean;
  conflicted_files: ConflictFileItem[];
}

export interface GitRemoteItem {
  name: string;
  url: string;
  is_official: boolean;
  is_private: boolean;
}

export interface GitRemotesResponse {
  remotes: GitRemoteItem[];
  official_configured: boolean;
  official_url?: string | null;
}

export interface ConfigureRemoteRequest {
  name: string;
  url: string;
}

export interface PreflightCheckItem {
  check: string;
  status: string;
  details: string;
}

export interface ReleaseSyncRequest {
  target_remote?: string;
  remote_url?: string;
  source_branch?: string;
  target_branch?: string;
  tag?: string;
  dry_run?: boolean;
  skip_tests?: boolean;
}

export interface ReleaseSyncResponse {
  success: boolean;
  target_remote: string;
  remote_url: string;
  source_branch: string;
  target_branch: string;
  release_tag?: string | null;
  commit_sha: string;
  short_sha: string;
  dry_run: boolean;
  message: string;
  preflight_checks: PreflightCheckItem[];
}

export const vcsApi = {
  getStatus: async (companyId: string): Promise<GitStatusResponse> => {
    return api.get<GitStatusResponse>(`/api/v1/companies/${companyId}/vcs/status`);
  },

  getTree: async (companyId: string): Promise<string[]> => {
    return api.get<string[]>(`/api/v1/companies/${companyId}/vcs/tree`);
  },

  getBranches: async (companyId: string): Promise<GitBranchesResponse> => {
    return api.get<GitBranchesResponse>(`/api/v1/companies/${companyId}/vcs/branches`);
  },

  createBranch: async (companyId: string, req: CreateBranchRequest): Promise<GitBranchesResponse> => {
    return api.post<GitBranchesResponse>(`/api/v1/companies/${companyId}/vcs/branches`, req);
  },

  checkoutBranch: async (companyId: string, req: CheckoutBranchRequest): Promise<GitBranchesResponse> => {
    return api.post<GitBranchesResponse>(`/api/v1/companies/${companyId}/vcs/checkout`, req);
  },

  stageFiles: async (companyId: string, req: StageFilesRequest): Promise<GitStatusResponse> => {
    return api.post<GitStatusResponse>(`/api/v1/companies/${companyId}/vcs/stage`, req);
  },

  unstageFiles: async (companyId: string, req: UnstageFilesRequest): Promise<GitStatusResponse> => {
    return api.post<GitStatusResponse>(`/api/v1/companies/${companyId}/vcs/unstage`, req);
  },

  discardFiles: async (companyId: string, req: DiscardFilesRequest): Promise<GitStatusResponse> => {
    return api.post<GitStatusResponse>(`/api/v1/companies/${companyId}/vcs/discard`, req);
  },

  createCommit: async (companyId: string, req: CreateCommitRequest): Promise<CommitResult> => {
    return api.post<CommitResult>(`/api/v1/companies/${companyId}/vcs/commit`, req);
  },

  getCommitLog: async (companyId: string, maxCount = 50, branch?: string): Promise<GitCommitLogResponse> => {
    const params = new URLSearchParams();
    params.set('max_count', String(maxCount));
    if (branch) params.set('branch', branch);
    return api.get<GitCommitLogResponse>(`/api/v1/companies/${companyId}/vcs/log?${params.toString()}`);
  },

  getDiff: async (
    companyId: string,
    filePath?: string,
    staged = false,
    commitSha?: string
  ): Promise<GitDiffResponse> => {
    const params = new URLSearchParams();
    if (filePath) params.set('file_path', filePath);
    if (staged) params.set('staged', 'true');
    if (commitSha) params.set('commit_sha', commitSha);
    return api.get<GitDiffResponse>(`/api/v1/companies/${companyId}/vcs/diff?${params.toString()}`);
  },

  getStashes: async (companyId: string): Promise<GitStashListResponse> => {
    return api.get<GitStashListResponse>(`/api/v1/companies/${companyId}/vcs/stashes`);
  },

  createStash: async (companyId: string, req: CreateStashRequest): Promise<GitStashListResponse> => {
    return api.post<GitStashListResponse>(`/api/v1/companies/${companyId}/vcs/stashes`, req);
  },

  applyStash: async (companyId: string, index: number): Promise<GitStatusResponse> => {
    return api.post<GitStatusResponse>(`/api/v1/companies/${companyId}/vcs/stashes/${index}/apply`, {});
  },

  popStash: async (companyId: string, index: number): Promise<GitStatusResponse> => {
    return api.post<GitStatusResponse>(`/api/v1/companies/${companyId}/vcs/stashes/${index}/pop`, {});
  },

  dropStash: async (companyId: string, index: number): Promise<GitStashListResponse> => {
    return api.delete<GitStashListResponse>(`/api/v1/companies/${companyId}/vcs/stashes/${index}`);
  },

  checkConflicts: async (companyId: string): Promise<ConflictCheckResponse> => {
    return api.get<ConflictCheckResponse>(`/api/v1/companies/${companyId}/vcs/conflicts`);
  },

  getRemotes: async (companyId: string): Promise<GitRemotesResponse> => {
    return api.get<GitRemotesResponse>(`/api/v1/companies/${companyId}/vcs/remotes`);
  },

  configureRemote: async (companyId: string, req: ConfigureRemoteRequest): Promise<GitRemotesResponse> => {
    return api.post<GitRemotesResponse>(`/api/v1/companies/${companyId}/vcs/remotes`, req);
  },

  syncRelease: async (companyId: string, req: ReleaseSyncRequest): Promise<ReleaseSyncResponse> => {
    return api.post<ReleaseSyncResponse>(`/api/v1/companies/${companyId}/vcs/release/sync`, req);
  },
};

