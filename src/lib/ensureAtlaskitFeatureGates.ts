import FeatureGates, { FeatureGateEnvironment } from '@atlaskit/feature-gate-js-client';

let initPromise: Promise<void> | null = null;

/**
 * Atlaskit Editor calls FeatureGates.checkGate at runtime. Outside Jira/Confluence the client
 * is never bootstrapped. This bootstraps with empty values and localMode (no Atlassian API).
 */
export function ensureAtlaskitFeatureGates(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = FeatureGates.initializeFromValues(
    {
      environment: import.meta.env.PROD
        ? FeatureGateEnvironment.Production
        : FeatureGateEnvironment.Development,
      targetApp: 'jira_web',
      localMode: true,
    },
    {},
    {},
    {},
  ).then(
    () => undefined,
    (err: unknown) => {
      console.warn('[ensureAtlaskitFeatureGates] initialization failed', err);
    },
  );

  return initPromise;
}
