import { getPreviewApiResponse } from './previewFixtures';

describe('all-page preview API fixtures', () => {
  it('provides read data for each primary dashboard area and nested detail view', () => {
    const company = '/api/v1/companies/preview-company-NEIMAN';
    const paths = [
      '/api/v1/companies/me',
      `${company}/agents`, `${company}/departments`, `${company}/roles`, `${company}/projects`,
      `${company}/governance/constitution`, `${company}/governance/autonomy-configs`,
      `${company}/governance/approvals`, `${company}/governance/escalations`, `${company}/governance/audits`,
      `${company}/decisions`, `${company}/workflows`, `${company}/workflows/preview-workflow-research/executions`,
      `${company}/councils`, `${company}/councils/preview-council-product/deliberations`,
      `${company}/intelligence/dashboard`, `${company}/intelligence/policy`, `${company}/intelligence/providers`, `${company}/intelligence/models`,
      `${company}/resources/control-center`, `${company}/resources/pools`, `${company}/resources/budgets`, `${company}/resources/requests`,
      `${company}/memory/items`, `${company}/memory/decisions`, `${company}/performance/summary`, `${company}/performance/metrics`, `${company}/performance/kpis`,
      `${company}/evolution/snapshots`, `${company}/evolution/adaptations`, `${company}/simulation/scenarios`,
      '/blueprints', '/blueprints/product-research-studio/export',
    ];

    for (const path of paths) {
      expect(getPreviewApiResponse(path)).toBeDefined();
    }
    expect(getPreviewApiResponse(`${company}/workflows`)).toHaveLength(2);
    expect(getPreviewApiResponse(`${company}/councils`)).toHaveLength(1);
    expect(getPreviewApiResponse(`${company}/performance/metrics`)).toHaveLength(3);
  });

  it('returns no fixture for unknown routes so the API client can fail closed', () => {
    expect(getPreviewApiResponse('/api/v1/companies/preview-company-NEIMAN/not-a-domain')).toBeUndefined();
  });
});
