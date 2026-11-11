'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Search,
  ChevronRight,
  ChevronDown,
  Code2,
  X,
  Plus,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { vcsApi, type GitStatusResponse } from '@/lib/api/vcs';
import { sourceGraphApi, type SourceFileViewResponse } from '@/lib/api/sourceGraph';

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
}

const DEFAULT_MONOREPO_FILE_TREE: string[] = [
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/globals.css',
  'apps/web/src/app/dashboard/page.tsx',
  'apps/web/src/app/dashboard/councils/page.tsx',
  'apps/web/src/app/dashboard/settings/page.tsx',
  'apps/web/src/components/layout/AppSidebar.tsx',
  'apps/web/src/components/explorer/FileTreeExplorer.tsx',
  'apps/web/src/lib/api/councils.ts',
  'apps/web/src/lib/api/cto.ts',
  'apps/web/src/lib/api/vcs.ts',
  'apps/api/src/main.py',
  'apps/api/src/routers/councils.py',
  'apps/api/src/routers/vcs.py',
  'packages/config/src/index.ts',
  'docker-compose.yml',
  'package.json',
  'README.md',
];

function buildTree(files: string[], gitStatus?: GitStatusResponse | null): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: {} };

  const changedMap = new Map<string, string>();
  if (gitStatus) {
    (gitStatus.staged_files || []).forEach((f) => changedMap.set(f.path, f.status || 'M'));
    (gitStatus.unstaged_files || []).forEach((f) => changedMap.set(f.path, f.status || 'M'));
    (gitStatus.untracked_files || []).forEach((p) => changedMap.set(p, '??'));
  }

  for (const file of files) {
    const parts = file.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const subPath = parts.slice(0, i + 1).join('/');

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: subPath,
          isDir: !isLast,
          children: {},
          status: isLast ? changedMap.get(subPath) : undefined,
        };
      } else if (isLast) {
        current.children[part].status = changedMap.get(subPath);
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
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({
    apps: true,
    'apps/web': true,
    'apps/api': true,
  });
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  // Fetch full repository file tree
  const { data: fileList = [], isLoading } = useQuery({
    queryKey: ['vcs-tree', companyId],
    queryFn: async () => {
      try {
        return await vcsApi.getTree(companyId);
      } catch {
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 30000,
  });

  // Fetch source file view when a file is selected for preview
  const { data: filePreviewData, isLoading: previewLoading } = useQuery({
    queryKey: ['source-file-preview', companyId, previewFile],
    queryFn: async () => {
      if (!previewFile) return null;
      try {
        return await sourceGraphApi.getSourceFile(companyId, previewFile, 1, 150);
      } catch {
        return null;
      }
    },
    enabled: !!companyId && !!previewFile,
  });

  // Filtered files (uses live vcs tree, or canonical monorepo fallback when unseeded)
  const effectiveFileList = useMemo(() => {
    if (fileList && fileList.length > 0) return fileList;
    return DEFAULT_MONOREPO_FILE_TREE;
  }, [fileList]);

  const filteredFiles = useMemo(() => {
    if (!filterQuery.trim()) return effectiveFileList;
    const q = filterQuery.toLowerCase();
    return effectiveFileList.filter((f) => f.toLowerCase().includes(q));
  }, [effectiveFileList, filterQuery]);

  const tree = useMemo(() => buildTree(filteredFiles, gitStatus), [filteredFiles, gitStatus]);

  const toggleDir = (dirPath: string) => {
    setOpenDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const handleFileClick = (filePath: string) => {
    setPreviewFile(filePath);
    onSelectFile?.(filePath);
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
          const isOpen = openDirs[child.path] ?? (filterQuery.length > 0 || depth === 0);

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
          const isSelected = previewFile === child.path;
          return (
            <div
              key={child.path}
              className={`flex items-center justify-between gap-1 py-1 px-1.5 rounded text-[11px] font-mono transition-colors group cursor-pointer ${
                isSelected
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-secondary/40 text-foreground'
              }`}
              style={{ paddingLeft: `${depth * 12 + 18}px` }}
              onClick={() => handleFileClick(child.path)}
            >
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                {getFileIcon(child.name)}
                <span className="truncate">{child.name}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {child.status && (
                  <span className="px-1 rounded text-[9px] font-bold bg-secondary text-foreground border border-border">
                    {child.status}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertToChat?.(child.path);
                  }}
                  title="Insert file into chat context"
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-primary transition-opacity"
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
      {/* Search Input Bar */}
      <div className="px-2.5 py-1.5 border-b border-border bg-secondary/20 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter files in repository…"
            className="w-full rounded-md border border-border bg-background pl-6 pr-2 py-1 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Directory Tree View */}
      <div className="flex-1 overflow-y-auto p-1.5 min-h-0 divide-y divide-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Scanning repository tree…</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 font-mono">
            No files found matching &quot;{filterQuery}&quot;
          </p>
        ) : (
          renderNode(tree)
        )}
      </div>

      {/* Lightweight Code Preview Drawer / Footer */}
      {previewFile && (
        <div className="border-t border-border bg-card p-2.5 space-y-2 shrink-0 animate-slide-up shadow-sm">
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Code2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-mono text-[11px] font-semibold text-foreground truncate">
                {previewFile}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPreviewFile(null)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {previewLoading ? (
            <div className="flex items-center justify-center py-2 text-xs text-muted-foreground gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading file preview…</span>
            </div>
          ) : filePreviewData ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>
                  {filePreviewData.language} · {filePreviewData.total_lines} lines
                </span>
                <span>{(filePreviewData.size_bytes / 1024).toFixed(1)} KB</span>
              </div>
              <pre className="p-2 rounded bg-secondary/40 text-[10px] font-mono text-foreground overflow-x-auto max-h-28 line-clamp-6 whitespace-pre">
                {filePreviewData.content}
              </pre>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
            <button
              type="button"
              onClick={() => {
                const snippet = filePreviewData?.content
                  ? `\n\`\`\`${filePreviewData.language || ''}\n${filePreviewData.content.slice(0, 500)}\n\`\`\``
                  : `\n\`\`\`\n// File reference: ${previewFile}\n\`\`\``;
                onInsertToChat?.(previewFile, snippet);
              }}
              className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-2.5 w-2.5" />
              <span>+ Insert into Chat</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

