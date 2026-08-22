'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  recordAdvancedToolVisit,
  resolveAdvancedTool,
} from '@/lib/dashboard/advanced-tool-meta';
import { AdvancedContextBar } from './AdvancedContextBar';
import { RelatedToolsRail } from './RelatedToolsRail';

interface AdvancedPageShellProps {
  children: ReactNode;
}

/**
 * Wraps advanced tool pages in layout — context bar + related tools.
 * Hub page and basic routes are excluded by the parent wrapper.
 */
export function AdvancedPageShell({ children }: AdvancedPageShellProps) {
  const pathname = usePathname();
  const ctx = resolveAdvancedTool(pathname);

  useEffect(() => {
    if (ctx.tool?.href) {
      recordAdvancedToolVisit(ctx.tool.href);
    }
  }, [ctx.tool?.href]);

  if (!ctx.isAdvanced || ctx.isHub || !ctx.tool || !ctx.section) {
    return <>{children}</>;
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <AdvancedContextBar
        pathname={pathname}
        tool={ctx.tool}
        section={ctx.section}
        sectionIndex={ctx.sectionIndex}
        toolIndex={ctx.toolIndex}
      />
      <div className="min-w-0">{children}</div>
      <RelatedToolsRail
        siblings={ctx.siblings}
        currentHref={ctx.tool.href}
        sectionLabel={ctx.section.label}
      />
    </div>
  );
}
