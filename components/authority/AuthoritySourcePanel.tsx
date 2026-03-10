'use client';

interface Connector {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

interface AuthoritySourcePanelProps {
  connectors: Connector[];
}

const CONNECTOR_DESCRIPTIONS: Record<string, string> = {
  'semantic-scholar': 'Validates scientific and statistical claims against 214M academic papers',
  'gov-au': 'Verifies Australian government statistics and policy references',
  'industry-registry': 'Validates IICRC standards, ASIC registrations, and NCC compliance',
  'claude-web-search': 'Searches authoritative .gov, .edu, and .org domains for claim verification',
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  government: 'text-emerald-400',
  academic: 'text-blue-400',
  industry: 'text-purple-400',
  web: 'text-slate-400',
};

export function AuthoritySourcePanel({ connectors }: AuthoritySourcePanelProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {connectors.map(connector => (
        <div
          key={connector.id}
          className="p-4 rounded-lg bg-white/5 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${connector.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span className="text-sm font-medium text-white">{connector.name}</span>
            <span className={`ml-auto text-xs ${SOURCE_TYPE_COLORS[connector.type] ?? 'text-slate-400'} capitalize`}>
              {connector.type}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {CONNECTOR_DESCRIPTIONS[connector.id] ?? `${connector.type} source connector`}
          </p>
          <p className={`text-xs mt-1 font-medium ${connector.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
            {connector.enabled ? 'Available' : 'Not configured'}
          </p>
        </div>
      ))}
    </div>
  );
}
