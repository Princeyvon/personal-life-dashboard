export type HealthStatus = {
  status: "ok";
  service: "personal-life-dashboard";
  timestamp: string;
  databaseConfigured: boolean;
  storageConfigured: boolean;
  llmConfigured: boolean;
};

export function getHealthStatus(env: NodeJS.ProcessEnv = process.env): HealthStatus {
  return {
    status: "ok",
    service: "personal-life-dashboard",
    timestamp: new Date().toISOString(),
    databaseConfigured: Boolean(env.DATABASE_URL),
    storageConfigured: Boolean(env.BUILT_IN_FORGE_API_URL && env.BUILT_IN_FORGE_API_KEY),
    llmConfigured: Boolean(env.BUILT_IN_FORGE_API_URL && env.BUILT_IN_FORGE_API_KEY),
  };
}
