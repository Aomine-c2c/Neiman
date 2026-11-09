'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Brain, 
  Zap, 
  Shield, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Settings,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Cpu,
  Database,
  Globe,
  Lock,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { createApiClient, createIntelligenceApi, type IntelligenceDashboard, type ModelProvider, type Model } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl, NEIMAN_CONFIG } from '@neiman/config';

export default function IntelligencePage() {
  const companyId = useAuthStore((state) => state.activeCompany?.id);
  const [dashboard, setDashboard] = useState<IntelligenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'providers' | 'models' | 'routing' | 'generate'>('dashboard');
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);

  const api = useMemo(() => createIntelligenceApi(createApiClient({
    baseUrl: getApiBaseUrl(),
    getToken: () => (typeof window !== 'undefined' ? localStorage.getItem(NEIMAN_CONFIG.STORAGE_KEYS.ACCESS_TOKEN) : null),
  })), []);

  const fetchDashboard = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await api.getDashboard(companyId);
      setDashboard(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [api, companyId]);

  useEffect(() => {
    if (companyId) void fetchDashboard();
  }, [companyId, fetchDashboard]);

  const handleGenerate = async () => {
    if (!generatePrompt.trim() || !companyId) return;
    try {
      setGenerateLoading(true);
      const result = await api.generate(companyId, {
        prompt: generatePrompt,
        required_capabilities: ['reasoning'],
        allow_fallback: true,
      });
      setGenerateResult(result.text);
    } catch (err: unknown) {
      setGenerateResult(`Error: ${err instanceof Error ? err.message : 'Generation failed'}`);
    } finally {
      setGenerateLoading(false);
    }
  };

  const formatCurrency = (value: number) => `$${value.toFixed(4)}`;
  const formatNumber = (value: number) => value.toLocaleString();

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Failed to load Intelligence Exchange</h3>
        <p className="text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Intelligence Exchange</h1>
          <p className="text-muted-foreground mt-1">
            Multi-vendor AI routing with cost, latency, privacy, and fallback optimization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', activeTab === 'generate' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80')}
            onClick={() => setActiveTab('generate')}
          >
            <Zap className="h-4 w-4 mr-2" />
            Generate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Activity },
          { id: 'providers', label: 'Providers', icon: Globe },
          { id: 'models', label: 'Models', icon: Cpu },
          { id: 'routing', label: 'Routing Policies', icon: ArrowUpDown },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(dashboard.total_requests)}</div>
                <p className="text-xs text-muted-foreground">All-time routed requests</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboard.total_spend_usd)}</div>
                <p className="text-xs text-muted-foreground">{formatNumber(dashboard.total_tokens_consumed)} tokens consumed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.avg_latency_ms.toFixed(0)}ms</div>
                <p className="text-xs text-muted-foreground">Average response time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(dashboard.overall_success_rate * 100).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Overall reliability</p>
              </CardContent>
            </Card>
          </div>

          {/* Provider Health & Model Count */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Provider Health</CardTitle>
                <CardDescription>{dashboard.healthy_providers_count} of {dashboard.providers_count} healthy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.available_providers.map((provider: ModelProvider) => (
                  <div key={provider.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-2 w-2 rounded-full', provider.is_healthy ? 'bg-green-500' : 'bg-red-500')} />
                      <span className="font-medium">{provider.display_name}</span>
                      {provider.is_local && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Local/On-premise" />}
                    </div>
                    <Badge variant={provider.is_healthy ? 'success' : 'destructive'}>
                      {provider.is_healthy ? 'Healthy' : 'Degraded'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Models</CardTitle>
                <CardDescription>{dashboard.models_count} models across providers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {dashboard.available_models.slice(0, 10).map((model: Model) => (
                  <div key={model.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{model.privacy_classification}</Badge>
                      <span className="font-medium">{model.display_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>${model.input_cost_per_million}/1M in</span>
                      <span>${model.output_cost_per_million}/1M out</span>
                      <span>{model.avg_latency_ms}ms</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Routing Decisions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {dashboard.recent_routing_decisions.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.success ? 'success' : 'destructive'} className="text-xs">
                        {log.success ? '✓' : '✗'}
                      </Badge>
                      <span className="font-medium">{log.model}</span>
                      {log.fallback && <Zap className="h-3 w-3 text-amber-500" aria-label="Routed via fallback" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>${log.cost_usd.toFixed(6)}</span>
                      <span>{log.latency_ms}ms</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'providers' && dashboard && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Model Providers</h2>
            <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Add Provider</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.available_providers.map((provider: ModelProvider) => (
              <Card key={provider.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{provider.display_name}</CardTitle>
                    <Badge variant={provider.is_healthy ? 'success' : 'destructive'}>
                      {provider.is_healthy ? 'Active' : 'Issues'}
                    </Badge>
                  </div>
                  <CardDescription>{provider.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {provider.is_local ? (
                      <Lock className="h-4 w-4" aria-label="Local/On-premise" />
                    ) : (
                      <Globe className="h-4 w-4" aria-label="Cloud Provider" />
                    )}
                    <span>{provider.is_local ? 'Local/On-premise' : 'Cloud Provider'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span><Shield className="h-3 w-3 mr-1" /> {provider.consecutive_failures} failures</span>
                    {provider.last_health_check_at && (
                      <span><Activity className="h-3 w-3 mr-1" /> Last check: {new Date(provider.last_health_check_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'models' && dashboard && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Registered Models</h2>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Filter models..." 
                className="input w-64 text-sm"
              />
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Add Model</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm text-muted-foreground">Model</th>
                  <th className="text-left p-3 font-medium text-sm text-muted-foreground">Provider</th>
                  <th className="text-left p-3 font-medium text-sm text-muted-foreground">Capabilities</th>
                  <th className="text-left p-3 font-medium text-sm text-muted-foreground">Context</th>
                  <th className="text-left p-3 font-medium text-sm text-muted-foreground">Cost (1M)</th>
                  <th className="text-left p-3 font-medium text-sm text-muted-foreground">Latency</th>
                  <th className="text-left p-3 font-medium text-sm text-muted-foreground">Privacy</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.available_models.map((model: Model) => (
                  <tr key={model.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="p-3">
                      <div className="font-medium">{model.display_name}</div>
                      <div className="text-xs text-muted-foreground">{model.model_identifier}</div>
                    </td>
                    <td className="p-3 text-sm">
                      {dashboard.available_providers.find(p => p.id === model.provider_id)?.display_name}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {model.capabilities.slice(0, 4).map((cap: string) => (
                          <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                        ))}
                        {model.capabilities.length > 4 && (
                          <Badge variant="outline" className="text-xs">+{model.capabilities.length - 4}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm">{model.context_capacity.toLocaleString()}</td>
                    <td className="p-3 text-sm">
                      In: ${model.input_cost_per_million}/M<br />
                      Out: ${model.output_cost_per_million}/M
                    </td>
                    <td className="p-3 text-sm">{model.avg_latency_ms}ms</td>
                    <td className="p-3">
                      <Badge variant={model.privacy_classification === 'ON_PREMISE_ZERO_RETENTION' ? 'success' : 'outline'}>
                        {model.privacy_classification}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'routing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Routing Policies</h2>
            <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Create Policy</Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Default Balanced Policy</CardTitle>
              <CardDescription>Company-wide routing strategy with capability preferences and fallback chain</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Strategy</h4>
                <div className="flex flex-wrap gap-2">
                  {['BALANCED', 'LOWEST_COST', 'LOWEST_LATENCY', 'HIGHEST_CAPABILITY', 'STRICT_PRIVACY'].map((strategy) => (
                    <Badge key={strategy} variant={strategy === 'BALANCED' ? 'default' : 'outline'}>
                      {strategy.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Capability Preferences</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ['Reasoning', 'claude-3-5-sonnet'],
                    ['Code Generation', 'gpt-4o'],
                    ['Large Context', 'gemini-1.5-pro'],
                    ['Privacy', 'local-deepseek-r1'],
                  ].map(([cap, model]) => (
                    <div key={cap} className="p-3 rounded-lg bg-secondary/50">
                      <div className="text-sm text-muted-foreground">{cap}</div>
                      <div className="font-mono text-sm">{model}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Fallback Chain</h4>
                <div className="flex flex-wrap items-center gap-2">
                  {['claude-3-5-sonnet', 'gemini-1.5-pro', 'local-deepseek-r1'].map((model, i) => (
                    <span key={model} className="flex items-center gap-1">
                      <Badge variant="outline">{model}</Badge>
                      {i < 2 && <ArrowUpDown className="h-4 w-4 text-muted-foreground mx-1" />}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Constraints</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <div className="text-muted-foreground">Max Cost/Query</div>
                    <div className="font-mono">$0.50</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <div className="text-muted-foreground">Max Latency</div>
                    <div className="font-mono">5000ms</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <div className="text-muted-foreground">Required Privacy</div>
                    <div className="font-mono">Any</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'generate' && (
        <Card>
          <CardHeader>
            <CardTitle>Generate Response</CardTitle>
            <CardDescription>Test the Intelligence Exchange with a custom prompt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Prompt</label>
              <Textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                rows={6}
                placeholder="Enter your prompt here..."
              />
            </div>
            
            <div className="flex items-center gap-4">
              <Button onClick={handleGenerate} disabled={generateLoading || !generatePrompt.trim()}>
                {generateLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>

            {generateResult && (
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="font-medium mb-2">Response</h4>
                <pre className="whitespace-pre-wrap text-sm font-mono">{generateResult}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
