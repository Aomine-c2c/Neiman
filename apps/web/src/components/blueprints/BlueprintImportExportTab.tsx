'use client';

import { Upload, Bookmark, RotateCw } from 'lucide-react';

interface BlueprintImportExportTabProps {
  importJsonText: string;
  setImportJsonText: (val: string) => void;
  importError: string | null;
  isImporting: boolean;
  onImport: () => void;
  activeCompany: { id: string; name: string } | null;
  templateKey: string;
  setTemplateKey: (val: string) => void;
  templateName: string;
  setTemplateName: (val: string) => void;
  templateDesc: string;
  setTemplateDesc: (val: string) => void;
  saveTemplateMsg: string | null;
  isSavingTemplate: boolean;
  onSaveTemplate: () => void;
}

export function BlueprintImportExportTab({
  importJsonText,
  setImportJsonText,
  importError,
  isImporting,
  onImport,
  activeCompany,
  templateKey,
  setTemplateKey,
  templateName,
  setTemplateName,
  templateDesc,
  setTemplateDesc,
  saveTemplateMsg,
  isSavingTemplate,
  onSaveTemplate,
}: BlueprintImportExportTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      {/* Card 1: Import Blueprint */}
      <div className="bg-NEIMAN-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Import Blueprint JSON</h3>
            <p className="text-xs text-muted-foreground">Load a custom organization blueprint specification.</p>
          </div>
        </div>

        <textarea
          rows={12}
          value={importJsonText}
          onChange={(e) => setImportJsonText(e.target.value)}
          placeholder='Paste blueprint JSON definition here (must contain "key", "name", "company_definition", "departments", "agents")...'
          className="w-full font-mono text-[11px] bg-secondary/40 border border-border rounded-lg p-3 text-foreground focus:outline-none focus:border-primary"
        />

        {importError && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {importError}
          </div>
        )}

        <button
          onClick={onImport}
          disabled={!importJsonText.trim() || isImporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-colors"
        >
          {isImporting ? <RotateCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import Blueprint
        </button>
      </div>

      {/* Card 2: Save Active Company as Template */}
      <div className="bg-NEIMAN-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Bookmark className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Save Company as Template</h3>
            <p className="text-xs text-muted-foreground">
              Harvest active organization structure into a reusable blueprint.
            </p>
          </div>
        </div>

        {activeCompany ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border text-xs">
              <span className="text-muted-foreground">Active Organization:</span>{' '}
              <span className="font-semibold text-foreground">{activeCompany.name}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Template Key (Slug)</label>
              <input
                type="text"
                placeholder="e.g. acme_holding_v1"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Template Display Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Holding Custom Architecture"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Document the purpose of this template..."
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {saveTemplateMsg && (
              <div className="p-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground">
                {saveTemplateMsg}
              </div>
            )}

            <button
              onClick={onSaveTemplate}
              disabled={!templateKey.trim() || !templateName.trim() || isSavingTemplate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors"
            >
              {isSavingTemplate ? (
                <RotateCw className="h-4 w-4 animate-spin" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
              Save As Reusable Template
            </button>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            Please select or create an active company first to harvest as a template.
          </div>
        )}
      </div>
    </div>
  );
}
