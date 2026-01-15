import fs from 'fs';
import path from 'path';

const MANIFEST_FILENAME = 'synthex.manifest.json';
const SYSTEM_INTEGRATION_FILENAME = 'synthex.system-integration.json';

const ensureFileExists = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required configuration missing: ${filePath}`);
  }
};

const readJsonFile = <T>(fileName: string): T => {
  const filePath = path.resolve(process.cwd(), fileName);
  ensureFileExists(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

export interface Manifest {
  meta: {
    codename: string;
    version: string;
    last_updated: string;
    runtime_requirement: string;
    framework: string;
  };
  agent_core: {
    identity: string;
    primary_directive: string;
    voice_calibration: {
      tone: string;
      style_guide: string;
    };
  };
  model_matrix: {
    reasoning_engine: {
      model: string;
      rationale: string;
    };
    velocity_engine: {
      model: string;
      rationale: string;
    };
    visual_cortex: {
      draft_mode: string;
      internal_alias: string;
      use_case: string;
    };
    artistic_cortex: {
      production_mode: string;
      use_case: string;
      lora_weights: string;
    };
    media_synthesizer: {
      video_model: string;
      audio_model: string;
      use_case: string;
    };
  };
  tool_definitions: Array<{
    name: string;
    endpoint?: string;
    provider?: string;
    source?: string;
    trigger?: string;
    strategy: string;
    config?: Record<string, unknown>;
    actions?: string[];
    auto_fix?: boolean;
  }>;
  autonomous_loops: Array<{
    id: string;
    trigger: string;
    target_urls?: string[];
    logic: string;
  }>;
  marketing_engine: {
    strategy: string;
    hook: string;
  };
}

export interface SystemIntegration {
  system_integration: {
    provider: string;
    last_sync: string;
    active_models: {
      frontier_model: ModelDescriptor;
      performance_model: Partial<ModelDescriptor>;
      video_engine: ModelDescriptor;
      edge_model: Partial<ModelDescriptor>;
    };
    automation_parameters: {
      webhook_compatibility: string;
      workflow_hooks: Record<string, string>;
      system_configuration: Record<string, boolean>;
    };
    metadata: {
      target_environments: string[];
    };
  };
}

interface ModelDescriptor {
  id: string;
  version?: string;
  capabilities?: string[];
  api_updates?: Record<string, unknown>;
  specialty?: string;
  use_case?: string;
  status?: string;
  deployment?: string;
}

const manifestCache = readJsonFile<Manifest>(MANIFEST_FILENAME);
const systemIntegrationCache = readJsonFile<SystemIntegration>(SYSTEM_INTEGRATION_FILENAME);

export const manifest = manifestCache;
export const systemIntegration = systemIntegrationCache.system_integration;

export const ModelRoles = Object.keys(manifest.model_matrix) as Array<
  keyof Manifest['model_matrix']
>;

export const getToolByName = (name: string) => {
  return manifest.tool_definitions.find(tool => tool.name === name);
};

export const listToolStrategies = () =>
  manifest.tool_definitions.map(tool => `${tool.name}: ${tool.strategy}`);

export const getAutonomousLoopSummary = () =>
  manifest.autonomous_loops.map(loop => `${loop.id} (${loop.trigger})`);

export const getModelReference = (role: keyof Manifest['model_matrix']) => {
  const entry = manifest.model_matrix[role];

  if ('model' in entry) {
    return entry.model;
  }

  if ('draft_mode' in entry) {
    return entry.draft_mode;
  }

  if ('production_mode' in entry) {
    return entry.production_mode;
  }

  if ('video_model' in entry) {
    return entry.video_model;
  }

  return '';
};

export const getShortModelId = (modelReference: string) => {
  const pieces = modelReference.split('/');
  return pieces.length > 1 ? pieces[pieces.length - 1] : modelReference;
};

export const getSystemIntegrationSummary = () => ({
  provider: systemIntegration.provider,
  syncDate: systemIntegration.last_sync,
  targetEnvironments: systemIntegration.metadata.target_environments.join(', '),
  workflowHooks: Object.entries(systemIntegration.automation_parameters.workflow_hooks).map(
    ([key, value]) => `${key}: ${value}`
  )
});

export const describeAgentDirective = () =>
  `${manifest.agent_core.identity} — ${manifest.agent_core.primary_directive}`;

export const validateRuntime = () => manifest.meta.runtime_requirement;
