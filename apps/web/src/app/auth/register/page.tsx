'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, AlertCircle, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { organizationsApi } from '@/lib/api/organizations';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/lib/api/client';
import { NEIMAN_CONFIG } from '@neiman/config';

const schema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  industry: z.string().max(100).optional(),
  mission: z.string().max(500).optional(),
  description: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterCompanyPage() {
  const router = useRouter();
  const { setActiveCompany } = useAuthStore();
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: 'NovaForge Technologies',
      industry: 'Software Engineering & AI Systems',
      mission: 'Autonomous Agile Product Engineering & Quality-Driven Delivery.',
      description: 'Autonomous software development company with preconfigured agents for each aspect of coding.',
    },
  });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      const company = await organizationsApi.create({
        name: data.name,
        industry: data.industry,
        mission: data.mission,
        description: data.description,
      });
      setActiveCompany(company);
      setSuccess(true);
      setTimeout(() => {
        router.replace(NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME);
      }, 1000);
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('Failed to register company. Ensure the NEIMAN API backend is active.');
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center overflow-hidden py-12 px-4 font-mono text-xs">
      <div className="relative w-full max-w-lg">
        {/* Header Branding */}
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#D71921] text-white font-bold text-lg shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-widest text-foreground">
            Register Your Company
          </h1>
          <p className="text-muted-foreground text-xs">Create the company workspace owned by your operator account.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Company Registered Successfully!</h2>
              <p className="text-xs text-muted-foreground">Initializing Command Center…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {apiError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              <div>
                <label htmlFor="company-name" className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Company Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="company-name"
                  type="text"
                  placeholder="e.g. Acme Autonomous Labs"
                  {...register('name')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {errors.name && (
                  <p className="text-[10px] text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="company-industry" className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Industry / Sector
                </label>
                <input
                  id="company-industry"
                  type="text"
                  placeholder="e.g. Aerospace, Fintech, Robotics"
                  {...register('industry')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="company-mission" className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Mission Statement
                </label>
                <textarea
                  id="company-mission"
                  rows={2}
                  placeholder="Core purpose and primary objectives of the autonomous organization..."
                  {...register('mission')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="company-description" className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Operational Description
                </label>
                <textarea
                  id="company-description"
                  rows={2}
                  placeholder="Overview of business domain, products, or autonomous directives..."
                  {...register('description')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 uppercase tracking-wider text-xs font-bold disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering Company…
                  </>
                ) : (
                  <>
                    Deploy & Launch Cockpit
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center border-t border-border/50">
                <Link
                  href={NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
                >
                  Skip to Command Center &rarr;
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
