'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Building2, Sparkles, Upload } from 'lucide-react';
import {
  blueprintsApi,
  CompanyBlueprint,
  BuildMyCompanyProposal,
  InstantiateBlueprintResponse,
  CompanyBlueprintUpdate,
  SaveAsTemplateRequest,
} from '@/lib/api/blueprints';
import { useOrganizationContext } from '@/lib/organizationContext';
import { useAuthStore } from '@/store/auth';
import {
  BlueprintCatalogTab,
  BuildMyCompanyTab,
  BlueprintImportExportTab,
  BlueprintInstantiationModal,
  InstantiationSuccessModal,
  BlueprintInspectModal,
  ProposalApprovalModal,
} from '@/components/blueprints';

export default function BlueprintsPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'build-my-company' | 'import-export'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Technology');

  // Blueprint Inspection & Customization Modal State
  const [inspectBlueprint, setInspectBlueprint] = useState<CompanyBlueprint | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMission, setEditMission] = useState('');
  const [editAutonomy, setEditAutonomy] = useState(3);

  // Instantiation Modal State
  const [instantiateModalBp, setInstantiateModalBp] = useState<CompanyBlueprint | null>(null);
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [instantiateAutonomy, setInstantiateAutonomy] = useState(3);
  const [instantiateCleanReset, setInstantiateCleanReset] = useState(false);
  const [instantiationSuccess, setInstantiationSuccess] = useState<InstantiateBlueprintResponse | null>(null);

  // Build My Company State
  const [promptText, setPromptText] = useState(
    'Create a software development company blueprint with product, architecture, engineering, QA, and release roles.'
  );
  const [targetBudget, setTargetBudget] = useState<number>(250);
  const [preferredAutonomy, setPreferredAutonomy] = useState<number>(3);
  const [proposal, setProposal] = useState<BuildMyCompanyProposal | null>(null);

  // Proposal In-Place Editing State
  const [isEditingProposal, setIsEditingProposal] = useState(false);
  const [propEditName, setPropEditName] = useState('');
  const [propEditMission, setPropEditMission] = useState('');
  const [propEditBudget, setPropEditBudget] = useState<number>(250);
  const [propEditAutonomy, setPropEditAutonomy] = useState<number>(3);

  // Approval Gate Modal State
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalName, setApprovalName] = useState('Founder & Managing Director');
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Save Company as Template State
  const activeCompany = useOrganizationContext();
  const [templateName, setTemplateName] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [saveTemplateMsg, setSaveTemplateMsg] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Queries
  const { data: blueprints = [], isLoading, refetch } = useQuery({
    queryKey: ['blueprints'],
    queryFn: () => blueprintsApi.listBlueprints(),
  });

  // Mutations
  const setActiveCompany = useAuthStore((state) => state.setActiveCompany);
  const instantiateMutation = useMutation({
    mutationFn: ({ idOrKey, req }: { idOrKey: string; req: { company_name?: string; customizations?: Record<string, unknown> } }) =>
      blueprintsApi.instantiateBlueprint(idOrKey, req),
    onSuccess: (data) => {
      setInstantiationSuccess(data);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['control-room-state'] });
      setActiveCompany({
        id: data.company_id,
        name: data.company_name,
        slug: data.slug,
        status: data.company_status,
        owner_id: data.owner_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => blueprintsApi.duplicateBlueprint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      refetch();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompanyBlueprintUpdate }) => blueprintsApi.updateBlueprint(id, data),
    onSuccess: (updated) => {
      setInspectBlueprint(updated);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      refetch();
    },
  });

  const buildMyCompanyMutation = useMutation({
    mutationFn: (req: { description: string; target_budget_monthly_usd?: number; preferred_autonomy_level?: number }) =>
      blueprintsApi.buildMyCompany(req),
    onSuccess: (data) => {
      setProposal(data);
      setPropEditName(data.proposed_blueprint?.name || '');
      setPropEditMission(data.proposed_blueprint?.company_definition?.mission || '');
      setPropEditBudget(data.estimated_operating_cost?.total_monthly_usd || 250);
      setPropEditAutonomy(data.proposed_blueprint?.default_autonomy || 3);
    },
  });

  const updateProposalMutation = useMutation({
    mutationFn: ({
      proposalId,
      payload,
    }: {
      proposalId: string;
      payload: {
        proposed_blueprint?: Record<string, unknown>;
        target_budget_monthly_usd?: number;
        preferred_autonomy_level?: number;
      };
    }) => blueprintsApi.updateProposal(proposalId, payload),
    onSuccess: (data) => {
      setProposal(data);
      setIsEditingProposal(false);
    },
  });

  const simulateProposalMutation = useMutation({
    mutationFn: (proposalId: string) =>
      blueprintsApi.simulateProposal(proposalId, { test_workload_size: 30, concurrency_level: 5 }),
    onSuccess: (data) => {
      setProposal(data);
    },
  });

  const instantiateProposalMutation = useMutation({
    mutationFn: ({ proposalId, approver, companyName, customizations }: { proposalId: string; approver: string; companyName?: string; customizations?: Record<string, unknown> }) =>
      blueprintsApi.instantiateProposal(proposalId, {
        approved_by: approver,
        confirmation_statement: 'Explicit human verification confirmed. Instantiating approved organizational blueprint.',
        custom_company_name: companyName,
        customizations,
      }),
    onSuccess: (data) => {
      setInstantiationSuccess(data);
      setShowApprovalModal(false);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['control-room-state'] });
      setActiveCompany({
        id: data.company_id,
        name: data.company_name,
        slug: data.slug,
        status: data.company_status,
        owner_id: data.owner_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => blueprintsApi.importBlueprint(payload),
    onSuccess: () => {
      setImportJsonText('');
      setImportError(null);
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      refetch();
      setActiveTab('catalog');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to import blueprint JSON';
      setImportError(msg);
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (req: SaveAsTemplateRequest) => blueprintsApi.saveAsTemplate(req),
    onSuccess: () => {
      setSaveTemplateMsg('Company successfully harvested and saved as reusable blueprint!');
      setTemplateName('');
      setTemplateKey('');
      setTemplateDesc('');
      queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      refetch();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save template';
      setSaveTemplateMsg(`Error: ${msg}`);
    },
  });

  // Handlers
  const openInspect = (bp: CompanyBlueprint) => {
    setInspectBlueprint(bp);
    setEditName(bp.name);
    setEditMission(bp.company_definition?.mission || '');
    setEditAutonomy(bp.default_autonomy);
    setIsEditing(false);
  };

  const handleExport = async (bp: CompanyBlueprint) => {
    try {
      const data = await blueprintsApi.exportBlueprint(bp.id);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${bp.key}_blueprint.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export blueprint');
    }
  };

  const handleImportSubmit = () => {
    try {
      setImportError(null);
      const parsed = JSON.parse(importJsonText);
      importMutation.mutate(parsed);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON format';
      setImportError(`Invalid JSON format: ${msg}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-7 w-7 text-primary" />
            NEIMAN Company Blueprints
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Instantiate preconfigured autonomous organizations or synthesize custom companies via natural language.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'catalog'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Building2 className="h-4 w-4" />
            Catalog ({blueprints.length})
          </button>
          <button
            onClick={() => setActiveTab('build-my-company')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'build-my-company'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            Build My Company
          </button>
          <button
            onClick={() => setActiveTab('import-export')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'import-export'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Upload className="h-4 w-4" />
            Import / Export / Template
          </button>
        </div>
      </div>

      {/* Tab 1: Catalog */}
      {activeTab === 'catalog' && (
        <BlueprintCatalogTab
          blueprints={blueprints}
          isLoading={isLoading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          isInstantiating={instantiateMutation.isPending}
          onQuickLaunch={(bpKey, companyName) =>
            instantiateMutation.mutate({
              idOrKey: bpKey,
              req: { company_name: companyName },
            })
          }
          onCustomizeLaunch={(bp) => {
            setInstantiateModalBp(bp);
            setCustomCompanyName(bp.company_definition?.name || bp.name);
          }}
          onInspect={openInspect}
          onDuplicate={(id) => duplicateMutation.mutate(id)}
          onExport={handleExport}
        />
      )}

      {/* Tab 2: Build My Company */}
      {activeTab === 'build-my-company' && (
        <BuildMyCompanyTab
          promptText={promptText}
          setPromptText={setPromptText}
          targetBudget={targetBudget}
          setTargetBudget={setTargetBudget}
          preferredAutonomy={preferredAutonomy}
          setPreferredAutonomy={setPreferredAutonomy}
          isSynthesizing={buildMyCompanyMutation.isPending}
          onSynthesize={() =>
            buildMyCompanyMutation.mutate({
              description: promptText,
              target_budget_monthly_usd: targetBudget,
              preferred_autonomy_level: preferredAutonomy,
            })
          }
          proposal={proposal}
          isEditingProposal={isEditingProposal}
          setIsEditingProposal={setIsEditingProposal}
          propEditName={propEditName}
          setPropEditName={setPropEditName}
          propEditMission={propEditMission}
          setPropEditMission={setPropEditMission}
          propEditBudget={propEditBudget}
          setPropEditBudget={setPropEditBudget}
          propEditAutonomy={propEditAutonomy}
          setPropEditAutonomy={setPropEditAutonomy}
          isUpdatingProposal={updateProposalMutation.isPending}
          onSaveProposalModifications={() => {
            if (!proposal) return;
            const updatedBp = {
              ...proposal.proposed_blueprint,
              name: propEditName,
              company_definition: {
                ...proposal.proposed_blueprint?.company_definition,
                name: propEditName,
                mission: propEditMission,
              },
            };
            updateProposalMutation.mutate({
              proposalId: proposal.id,
              payload: {
                proposed_blueprint: updatedBp,
                target_budget_monthly_usd: propEditBudget,
                preferred_autonomy_level: propEditAutonomy,
              },
            });
          }}
          isSimulatingProposal={simulateProposalMutation.isPending}
          onSimulateProposal={() => proposal && simulateProposalMutation.mutate(proposal.id)}
          onOpenApproval={() => setShowApprovalModal(true)}
        />
      )}

      {/* Tab 3: Import / Export / Template */}
      {activeTab === 'import-export' && (
        <BlueprintImportExportTab
          importJsonText={importJsonText}
          setImportJsonText={setImportJsonText}
          importError={importError}
          isImporting={importMutation.isPending}
          onImport={handleImportSubmit}
          activeCompany={activeCompany}
          templateKey={templateKey}
          setTemplateKey={setTemplateKey}
          templateName={templateName}
          setTemplateName={setTemplateName}
          templateDesc={templateDesc}
          setTemplateDesc={setTemplateDesc}
          saveTemplateMsg={saveTemplateMsg}
          isSavingTemplate={saveTemplateMutation.isPending}
          onSaveTemplate={() => {
            if (!activeCompany) return;
            saveTemplateMutation.mutate({
              company_id: activeCompany.id,
              template_key: templateKey,
              template_name: templateName,
              description: templateDesc,
            });
          }}
        />
      )}

      {/* Modals */}
      <BlueprintInstantiationModal
        blueprint={instantiateModalBp}
        onClose={() => setInstantiateModalBp(null)}
        onSuccess={(data) => {
          setInstantiateModalBp(null);
          setInstantiationSuccess(data);
          queryClient.invalidateQueries({ queryKey: ['companies'] });
          queryClient.invalidateQueries({ queryKey: ['organizations'] });
        }}
      />

      <InstantiationSuccessModal
        result={instantiationSuccess}
        onClose={() => setInstantiationSuccess(null)}
      />

      <BlueprintInspectModal
        blueprint={inspectBlueprint}
        onClose={() => setInspectBlueprint(null)}
        onInstantiate={(bp) => {
          setInspectBlueprint(null);
          setInstantiateModalBp(bp);
        }}
        onExport={handleExport}
        onUpdate={async (id, data) => {
          await updateMutation.mutateAsync({ id, data });
        }}
        isUpdating={updateMutation.isPending}
      />

      <ProposalApprovalModal
        isOpen={showApprovalModal}
        proposal={proposal}
        isPending={instantiateProposalMutation.isPending}
        onClose={() => setShowApprovalModal(false)}
        onApprove={(payload) => {
          if (!proposal) return;
          instantiateProposalMutation.mutate({
            proposalId: proposal.id,
            approver: payload.approver,
            companyName: payload.companyName,
            customizations: payload.customizations,
          });
        }}
      />
    </div>
  );
}
