import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SystemSetupWizard } from './SystemSetupWizard';
import { blueprintsApi } from '@/lib/api/blueprints';
import { systemConfigApi } from '@/lib/api/systemUpdates';

jest.mock('@/lib/api/blueprints', () => ({
  blueprintsApi: {
    listBlueprints: jest.fn(),
    instantiateBlueprint: jest.fn(),
  },
}));

jest.mock('@/lib/api/systemUpdates', () => ({
  systemConfigApi: {
    getProviderKeys: jest.fn(),
    updateProviderKeys: jest.fn(),
    getExtendedHealth: jest.fn(),
    resetSetup: jest.fn(),
  },
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    setActiveCompany: jest.fn(),
  }),
}));

function renderWizard(props: Partial<React.ComponentProps<typeof SystemSetupWizard>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <SystemSetupWizard isOpen={true} {...props} />
    </QueryClientProvider>
  );
}

describe('SystemSetupWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(systemConfigApi.getProviderKeys).mockResolvedValue({
      openai_configured: false,
      anthropic_configured: false,
      gemini_configured: true,
      ollama_host: 'http://localhost:11434',
      openai_fingerprint: null,
      anthropic_fingerprint: null,
      gemini_fingerprint: 'Configured — hidden',
    });
    jest.mocked(blueprintsApi.listBlueprints).mockResolvedValue([
      {
        id: 'bp-1',
        key: 'software_development_company',
        name: 'Software Development Company',
        tagline: 'Software engineering',
        category: 'Technology',
        icon: 'Code',
        version: 1,
        description: 'Full-lifecycle software engineering organization',
        default_autonomy: 2,
        estimated_monthly_cost_usd: 200,
        is_system_template: true,
        company_definition: {
          name: 'Software Co',
          industry: 'Software',
          mission: 'Build software',
          vision: 'Autonomous delivery',
        },
        departments: [],
        roles: [],
        agents: [
          {
            name: 'Atlas',
            role_title: 'Chief Architect',
            department_name: 'Engineering',
            system_instructions: 'Lead architecture',
            autonomy_level: 3,
            capabilities: ['architecture', 'adr'],
            responsibilities: ['Design systems'],
          },
        ],
        workflows: [],
        policies: [],
        constitution: {
          mission: 'Build software',
          values: [],
          operating_principles: [],
          prohibited_actions: [],
          approval_requirements: [],
          security_rules: [],
          financial_rules: [],
          data_rules: [],
          autonomy_boundaries: {},
          escalation_rules: [],
        },
        recommended_tools: [],
        intelligence_requirements: {},
        resource_policies: {},
        kpis: [],
        approval_rules: [],
        escalation_rules: [],
        metadata_tags: [],
        created_at: '',
        updated_at: '',
      },
      {
        id: 'bp-2',
        key: 'cybersecurity_sentinel_org',
        name: 'Cybersecurity Operations Center',
        tagline: 'Autonomous SOC',
        category: 'Security',
        icon: 'Shield',
        version: 1,
        description: 'Autonomous threat hunting and incident response swarm',
        default_autonomy: 3,
        estimated_monthly_cost_usd: 300,
        is_system_template: true,
        company_definition: {
          name: 'SecOps',
          industry: 'Security',
          mission: 'Defend infrastructure',
          vision: 'Zero-breach security',
        },
        departments: [],
        roles: [],
        agents: [
          {
            name: 'Aegis',
            role_title: 'SOC Lead',
            department_name: 'Defense',
            system_instructions: 'Monitor threats',
            autonomy_level: 3,
            capabilities: ['siem', 'triage'],
            responsibilities: ['Monitor threats'],
          },
        ],
        workflows: [],
        policies: [],
        constitution: {
          mission: 'Defend infrastructure',
          values: [],
          operating_principles: [],
          prohibited_actions: [],
          approval_requirements: [],
          security_rules: [],
          financial_rules: [],
          data_rules: [],
          autonomy_boundaries: {},
          escalation_rules: [],
        },
        recommended_tools: [],
        intelligence_requirements: {},
        resource_policies: {},
        kpis: [],
        approval_rules: [],
        escalation_rules: [],
        metadata_tags: [],
        created_at: '',
        updated_at: '',
      },
    ]);
  });

  it('allows selecting from multiple catalog blueprints and requires in-modal typed confirmation for clean reset', async () => {
    renderWizard();

    // Advance from Welcome -> Providers -> Configure
    fireEvent.click(screen.getByRole('button', { name: /Continue: Link AI Models/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue without provider/i }));

    // Verify both catalog blueprints appear in the Blueprint Selector
    expect(await screen.findByText('Software Development Company')).toBeInTheDocument();
    expect(screen.getByText('Cybersecurity Operations Center')).toBeInTheDocument();

    // Select the second blueprint
    fireEvent.click(screen.getByText('Cybersecurity Operations Center'));
    expect(await screen.findByText('Aegis')).toBeInTheDocument();

    // Enter company name
    fireEvent.change(screen.getByPlaceholderText(/e.g. Acme Software/i), {
      target: { value: 'Sentinel Defense Corp' },
    });

    // Enable clean reset checkbox
    const resetCheckbox = screen.getByRole('checkbox', {
      name: /Reset existing operational data before creating the company/i,
    });
    fireEvent.click(resetCheckbox);

    // In-modal confirmation input should appear and block launch until phrase matches
    const confirmInput = screen.getByPlaceholderText('RESET NEIMAN OPERATIONAL DATA');
    expect(confirmInput).toBeInTheDocument();

    const launchBtn = screen.getByRole('button', { name: /Create Company from Blueprint/i });
    expect(launchBtn).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: 'RESET NEIMAN OPERATIONAL DATA' } });
    expect( launchBtn ).not.toBeDisabled();

    // Verify Repository Connection Modes (Local Directory, Git Repository URL, Recent Workspaces) are accessible
    expect(screen.getByText(/Local Directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Git Repository URL/i)).toBeInTheDocument();

    jest.mocked(systemConfigApi.resetSetup).mockResolvedValue({
      status: 'ok',
      message: 'Reset complete',
    });
    jest.mocked(blueprintsApi.instantiateBlueprint).mockResolvedValue({
      company_id: 'c-new',
      company_name: 'Sentinel Defense Corp',
      slug: 'sentinel-defense-corp',
      company_status: 'ACTIVE',
      owner_id: 'u-1',
      created_at: '',
      updated_at: '',
      departments_created: 1,
      roles_created: 1,
      agents_created: 1,
      workflows_created: 1,
      policies_created: 1,
      projects_created: 1,
      tasks_created: 1,
      constitution_established: true,
      status: 'COMPLETED',
      message: 'Instantiated successfully',
    });

    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(systemConfigApi.resetSetup).toHaveBeenCalledWith('RESET NEIMAN OPERATIONAL DATA');
      expect(blueprintsApi.instantiateBlueprint).toHaveBeenCalledWith(
        'cybersecurity_sentinel_org',
        expect.objectContaining({ company_name: 'Sentinel Defense Corp' })
      );
    });
  });
});
