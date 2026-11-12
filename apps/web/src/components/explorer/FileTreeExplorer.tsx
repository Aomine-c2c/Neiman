'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  Minus,
  Loader2,
  GitCompare,
  Filter,
} from 'lucide-react';
import { vcsApi, type GitStatusResponse } from '@/lib/api/vcs';

interface FileTreeExplorerProps {
  companyId: string;
  gitStatus?: GitStatusResponse | null;
  onSelectFile?: (filePath: string) => void;
  onInsertToChat?: (filePath: string, snippet?: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: Record<string, TreeNode>;
  status?: string;
  staged?: boolean;
}

const DEFAULT_MONOREPO_FILE_TREE: string[] = [
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/globals.css',
  'apps/web/src/app/dashboard/layout.tsx',
  'apps/web/src/app/dashboard/councils/page.tsx',
  'apps/web/src/app/dashboard/settings/page.tsx',
  'apps/web/src/components/layout/AppSidebar.tsx',
  'apps/web/src/components/layout/AgentContributionGraph.tsx',
  'apps/web/src/components/explorer/FileTreeExplorer.tsx',
  'apps/web/src/components/terminal/BashTerminal.tsx',
  'apps/web/src/lib/api/councils.ts',
  'apps/web/src/lib/api/cto.ts',
  'apps/web/src/lib/api/vcs.ts',
  'apps/api/nexora/main.py',
  'apps/api/nexora/config.py',
  'apps/api/nexora/domains/vcs/router.py',
  'apps/api/nexora/domains/vcs/service.py',
  'packages/config/index.ts',
  'docker-compose.yml',
  'package.json',
  'README.md',
];

function buildTree(files: string[], gitStatus?: GitStatusResponse | null): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: {} };

  const changedMap = new Map<string, { status: string; staged: boolean }>();
  if (gitStatus) {
    (gitStatus.staged_files || []).forEach((f) =>
      changedMap.set(f.path, { status: f.status || 'M', staged: true })
    );
    (gitStatus.unstaged_files || []).forEach((f) =>
      changedMap.set(f.path, { status: f.status || 'M', staged: false })
    );
    (gitStatus.untracked_files || []).forEach((p) =>
      changedMap.set(p, { status: '??', staged: false })
    );
  }

  for (const file of files) {
    const parts = file.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const subPath = parts.slice(0, i + 1).join('/');
      const changeInfo = isLast ? changedMap.get(subPath) : undefined;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: subPath,
          isDir: !isLast,
          children: {},
          status: changeInfo?.status,
          staged: changeInfo?.staged,
        };
      } else if (isLast && changeInfo) {
        current.children[part].status = changeInfo.status;
        current.children[part].staged = changeInfo.staged;
      }
      current = current.children[part];
    }
  }

  return root;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'json'].includes(ext || '')) {
    return <FileCode className="h-3.5 w-3.5 text-foreground shrink-0" />;
  }
  return <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export function FileTreeExplorer({
  companyId,
  gitStatus,
  onSelectFile,
  onInsertToChat,
}: FileTreeExplorerProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch full repository file tree
  const { data: fileList = [], isLoading, isError: treeError, refetch: refetchTree } = useQuery({
    queryKey: ['vcs-tree', companyId],
    queryFn: async () => {
      return vcsApi.getTree(companyId);
    },
    enabled: !!companyId,
    staleTime: 30000,
    retry: 1,
  });

  const stageMutation = useMutation({
    mutationFn: (path: string) => vcsApi.stageFiles(companyId, { paths: [path] }),
    onSuccess: () => {
      queryClient?.invalidateQueries({ queryKey: ['vcs-status', companyId] });
      queryClient?.invalidateQueries({ queryKey: ['vcs-status-chat', companyId] });
    },
  });

  const unstageMutation = useMutation({
    mutationFn: (path: string) => vcsApi.unstageFiles(companyId, { paths: [path] }),
    onSuccess: () => {
      queryClient?.invalidateQueries({ queryKey: ['vcs-status', companyId] });
      queryClient?.invalidateQueries({ queryKey: ['vcs-status-chat', companyId] });
    },
  });

  const changedFileSet = useMemo(() => {
    const set = new Set<string>();
    if (gitStatus) {
      (gitStatus.staged_files || []).forEach((f) => set.add(f.path));
      (gitStatus.unstaged_files || []).forEach((f) => set.add(f.path));
      (gitStatus.untracked_files || []).forEach((p) => set.add(p));
    }
    return set;
  }, [gitStatus]);

  // Filtered files strictly from live repository tree + live git status changes
  const effectiveFileList = useMemo(() => {
    const merged = new Set(fileList || []);
    changedFileSet.forEach((p) => merged.add(p));
    return Array.from(merged);
  }, [fileList, changedFileSet]);

  const filteredFiles = useMemo(() => {
    let list = effectiveFileList;
    if (modifiedOnly) {
      list = list.filter((f) => changedFileSet.has(f));
    }
    if (!filterQuery.trim()) return list;
    const q = filterQuery.toLowerCase();
    return list.filter((f) => f.toLowerCase().includes(q));
  }, [effectiveFileList, filterQuery, modifiedOnly, changedFileSet]);

  const tree = useMemo(() => buildTree(filteredFiles, gitStatus), [filteredFiles, gitStatus]);

  const toggleDir = (dirPath: string) => {
    setOpenDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const handleFileClick = (filePath: string, mode: 'code' | 'diff' = 'code', staged = false) => {
    setSelectedFile(filePath);
    onSelectFile?.(filePath);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:open-code-viewer', {
          detail: { filePath, mode, staged },
        })
      );
    }
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const sortedKeys = Object.keys(node.children).sort((a, b) => {
      const aIsDir = node.children[a].isDir;
      const bIsDir = node.children[b].isDir;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.localeCompare(b);
    });

    return (
      <div className="space-y-0.5">
        {sortedKeys.map((key) => {
          const child = node.children[key];
          const isOpen =
            openDirs[child.path] ?? (filterQuery.length > 0 || modifiedOnly || depth === 0);

          if (child.isDir) {
            return (
              <div key={child.path} className="select-none">
                <button
                  type="button"
                  onClick={() => toggleDir(child.path)}
                  className="flex items-center gap-1.5 w-full py-1 px-1.5 rounded hover:bg-secondary/50 text-[11px] font-mono text-muted-foreground hover:text-foreground text-left transition-colors"
                  style={{ paddingLeft: `${depth * 12 + 6}px` }}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  {isOpen ? (
                    <FolderOpen className="h-3.5 w-3.5 text-primary/80 shrink-0" />
                  ) : (
                    <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{child.name}</span>
                </button>
                {isOpen && renderNode(child, depth + 1)}
              </div>
            );
          }

          // File Node
          const isSelected = selectedFile === child.path;
          return (
            <div
              key={child.path}
              role="treeitem"
              aria-selected={isSelected}
              className={`flex items-center justify-between gap-1 py-0.5 pr-1.5 rounded text-[11px] font-mono transition-colors group ${
                isSelected
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-secondary/40 text-foreground'
              }`}
              style={{ paddingLeft: `${depth * 12 + 14}px` }}
            >
              <button
                type="button"
                onClick={() => handleFileClick(child.path, 'code', Boolean(child.staged))}
                className="flex items-center gap-1.5 min-w-0 flex-1 min-h-6 text-left truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {getFileIcon(child.name)}
                <span className="truncate" title={child.path}>
                  {child.name}
                </span>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {child.status && (
                  <>
                    <span
                      className={`px-1 rounded text-[10px] font-bold border ${
                        child.staged
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {child.staged ? 'S' : child.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFileClick(child.path, 'diff', Boolean(child.staged))}
                      title="View file diff in Right Panel"
                      aria-label={`View diff for ${child.path}`}
                      className="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <GitCompare className="h-3 w-3" />
                    </button>
                    {child.staged ? (
                      <button
                        type="button"
                        onClick={() => unstageMutation.mutate(child.path)}
                        title="Unstage file (-)"
                        aria-label={`Unstage ${child.path}`}
                        className="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 rounded text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 hover:bg-secondary transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => stageMutation.mutate(child.path)}
                        title="Stage file (+)"
                        aria-label={`Stage ${child.path}`}
                        className="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 rounded text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-secondary transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onInsertToChat?.(child.path)}
                  title="Attach file to chat context"
                  aria-label={`Attach ${child.path} to chat`}
                  className="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 rounded text-muted-foreground hover:text-primary transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Search Input & Modified Only Filter Bar */}
      <div className="px-2.5 py-1.5 border-b border-border bg-secondary/20 shrink-0 flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files in repository…"
            aria-label="Filter files in repository"
            className="w-full rounded-md border border-border bg-background pl-6 pr-6 py-1 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              aria-label="Clear file filter"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-6 min-w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModifiedOnly((v) => !v)}
          aria-pressed={modifiedOnly}
          title={
            modifiedOnly
              ? 'Showing modified files only (Click to show all)'
              : `Filter modified files only (${changedFileSet.size})`
          }
          className={`inline-flex items-center gap-1 min-h-6 px-2 py-0.5 rounded-md border text-[11px] font-mono transition-colors shrink-0 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            modifiedOnly
              ? 'bg-primary text-primary-foreground border-primary font-bold'
              : 'bg-background text-muted-foreground border-border hover:text-foreground'
          }`}
        >
          <Filter className="h-2.5 w-2.5" />
          <span>Mod</span>
          {changedFileSet.size > 0 && <span>({changedFileSet.size})</span>}
        </button>
      </div>

      {/* Directory Tree View */}
      <div role="tree" aria-label="Repository file tree" className="flex-1 overflow-y-auto p-1.5 min-h-0 divide-y divide-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Scanning repository tree…</span>
          </div>
        ) : treeError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 px-3 text-center">
            <p className="text-[11px] font-mono text-rose-700 dark:text-rose-400">
              Failed to load repository file tree.
            </p>
            <button
              type="button"
              onClick={() => refetchTree()}
              className="min-h-6 px-2.5 py-0.5 rounded border border-border bg-secondary text-[11px] font-mono text-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry
            </button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-2 font-mono">
            {modifiedOnly
              ? 'Working tree is clean (0 modified files)'
              : filterQuery
              ? `No files found matching "${filterQuery}"`
              : 'No repository files indexed yet.'}
          </p>
        ) : (
          renderNode(tree)
        )}
      </div>
    </div>
  );
}
