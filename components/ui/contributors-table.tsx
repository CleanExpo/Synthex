'use client';

import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Contributor = {
  name: string;
  email: string;
  avatar: string;
  role: string;
};

type Project = {
  id: string;
  title: string;
  repo: string;
  status: 'Active' | 'Inactive' | 'In Progress';
  team: string;
  tech: string;
  createdAt: string;
  contributors: Contributor[];
};

const data: Project[] = [
  {
    id: '1',
    title: 'ShadCN Clone',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'UI Guild',
    tech: 'Next.js',
    createdAt: '01/06/2024',
    contributors: [
      {
        name: 'Srinath G',
        email: 'srinath@example.com',
        avatar: 'https://github.com/srinath.png',
        role: 'UI Lead',
      },
      {
        name: 'Kavya M',
        email: 'kavya@example.com',
        avatar: 'https://github.com/kavya.png',
        role: 'Designer',
      },
    ],
  },
  {
    id: '2',
    title: 'RUIXEN Components',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'In Progress',
    team: 'Component Devs',
    tech: 'React',
    createdAt: '22/05/2024',
    contributors: [
      {
        name: 'Arjun R',
        email: 'arjun@example.com',
        avatar: 'https://github.com/arjun.png',
        role: 'Developer',
      },
      {
        name: 'Divya S',
        email: 'divya@example.com',
        avatar: 'https://github.com/divya.png',
        role: 'QA',
      },
      {
        name: 'Nikhil V',
        email: 'nikhil@example.com',
        avatar: 'https://github.com/nikhil.png',
        role: 'UX',
      },
    ],
  },
  {
    id: '3',
    title: 'CV Jobs Platform',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'CV Core',
    tech: 'Spring Boot',
    createdAt: '05/06/2024',
    contributors: [
      {
        name: 'Manoj T',
        email: 'manoj@example.com',
        avatar: 'https://github.com/manoj.png',
        role: 'Backend Lead',
      },
    ],
  },
  {
    id: '4',
    title: 'Ruixen UI Docs',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'Tech Writers',
    tech: 'Markdown + Docusaurus',
    createdAt: '19/04/2024',
    contributors: [
      {
        name: 'Sneha R',
        email: 'sneha@example.com',
        avatar: 'https://github.com/sneha.png',
        role: 'Documentation',
      },
      {
        name: 'Vinay K',
        email: 'vinay@example.com',
        avatar: 'https://github.com/vinay.png',
        role: 'Maintainer',
      },
    ],
  },
  {
    id: '5',
    title: 'Job Portal Analytics',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'Data Squad',
    tech: 'Python',
    createdAt: '30/03/2024',
    contributors: [
      {
        name: 'Aarav N',
        email: 'aarav@example.com',
        avatar: 'https://github.com/aarav.png',
        role: 'Data Engineer',
      },
    ],
  },
  {
    id: '6',
    title: 'Real-time Chat',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'Infra',
    tech: 'Socket.io',
    createdAt: '03/06/2024',
    contributors: [
      {
        name: 'Neha L',
        email: 'neha@example.com',
        avatar: 'https://github.com/neha.png',
        role: 'DevOps',
      },
      {
        name: 'Raghav I',
        email: 'raghav@example.com',
        avatar: 'https://github.com/raghav.png',
        role: 'NodeJS Engineer',
      },
    ],
  },
  {
    id: '7',
    title: 'RUX Theme Builder',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'Design Systems',
    tech: 'Tailwind CSS',
    createdAt: '10/05/2024',
    contributors: [
      {
        name: 'Ishita D',
        email: 'ishita@example.com',
        avatar: 'https://github.com/ishita.png',
        role: 'Design Engineer',
      },
    ],
  },
  {
    id: '8',
    title: 'Admin Dashboard',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'Dashboard Core',
    tech: 'Remix',
    createdAt: '28/05/2024',
    contributors: [
      {
        name: 'Rahul B',
        email: 'rahul@example.com',
        avatar: 'https://github.com/rahul.png',
        role: 'Fullstack',
      },
    ],
  },
  {
    id: '9',
    title: 'OpenCV Blog Engine',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'Platform',
    tech: 'Node.js',
    createdAt: '18/01/2024',
    contributors: [
      {
        name: 'Sanya A',
        email: 'sanya@example.com',
        avatar: 'https://github.com/sanya.png',
        role: 'API Developer',
      },
      {
        name: 'Harshit V',
        email: 'harshit@example.com',
        avatar: 'https://github.com/harshit.png',
        role: 'Platform Architect',
      },
    ],
  },
  {
    id: '10',
    title: 'Dark Mode Toggle Package',
    repo: 'https://github.com/ruixenui/ruixen-buttons',
    status: 'Active',
    team: 'Component Devs',
    tech: 'TypeScript',
    createdAt: '02/06/2024',
    contributors: [
      {
        name: 'Meera C',
        email: 'meera@example.com',
        avatar: 'https://github.com/meera.png',
        role: 'Package Maintainer',
      },
    ],
  },
];

const allColumns = [
  'Project',
  'Repository',
  'Team',
  'Tech',
  'Created At',
  'Contributors',
  'Status',
] as const;

function statusClasses(status: Project['status']): string {
  if (status === 'Active')
    return 'bg-emerald-500/[0.15] text-emerald-300 border-emerald-500/20';
  if (status === 'In Progress')
    return 'bg-orange-500/[0.15] text-orange-300 border-orange-500/20';
  return 'bg-white/[0.04] text-white/40 border-white/[0.06]';
}

export function ContributorsTable() {
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    ...allColumns,
  ]);
  const [statusFilter, setStatusFilter] = useState('');
  const [techFilter, setTechFilter] = useState('');

  const filteredData = data.filter(project => {
    return (
      (!statusFilter ||
        project.status.toLowerCase().includes(statusFilter.toLowerCase())) &&
      (!techFilter ||
        project.tech.toLowerCase().includes(techFilter.toLowerCase()))
    );
  });

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  return (
    <div className="w-full space-y-4 p-4 border-[0.5px] border-white/[0.06] rounded-sm bg-[#050505] overflow-x-auto">
      {/* Filters + column toggle */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Filter by technology…"
            value={techFilter}
            onChange={e => setTechFilter(e.target.value)}
            className="w-44 bg-[#0a0a0a] border-[0.5px] border-white/[0.06] text-white placeholder:text-white/40 rounded-sm text-sm focus-visible:ring-orange-500/20"
          />
          <Input
            placeholder="Filter by status…"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-44 bg-[#0a0a0a] border-[0.5px] border-white/[0.06] text-white placeholder:text-white/40 rounded-sm text-sm focus-visible:ring-orange-500/20"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-[#0a0a0a] border-[0.5px] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.04] rounded-sm text-xs gap-1"
            >
              Columns
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44 bg-[#050505] border-[0.5px] border-white/[0.06] rounded-sm">
            {allColumns.map(col => (
              <DropdownMenuCheckboxItem
                key={col}
                checked={visibleColumns.includes(col)}
                onCheckedChange={() => toggleColumn(col)}
                className="text-white/60 text-xs focus:bg-white/[0.04] focus:text-white"
              >
                {col}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {visibleColumns.includes('Project') && (
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-white/40 w-[180px]">
                  Project
                </th>
              )}
              {visibleColumns.includes('Repository') && (
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-white/40 w-[220px]">
                  Repository
                </th>
              )}
              {visibleColumns.includes('Team') && (
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-white/40 w-[150px]">
                  Team
                </th>
              )}
              {visibleColumns.includes('Tech') && (
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-white/40 w-[150px]">
                  Tech
                </th>
              )}
              {visibleColumns.includes('Created At') && (
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-white/40 w-[120px]">
                  Created At
                </th>
              )}
              {visibleColumns.includes('Contributors') && (
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-white/40 w-[150px]">
                  Contributors
                </th>
              )}
              {visibleColumns.includes('Status') && (
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-white/40 w-[120px]">
                  Status
                </th>
              )}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {filteredData.length ? (
              filteredData.map(project => (
                <tr
                  key={project.id}
                  className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.02]"
                >
                  {visibleColumns.includes('Project') && (
                    <td className="p-3 align-middle font-medium whitespace-nowrap text-white">
                      {project.title}
                    </td>
                  )}
                  {visibleColumns.includes('Repository') && (
                    <td className="p-3 align-middle whitespace-nowrap">
                      <a
                        href={project.repo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-300 transition-colors text-xs"
                      >
                        {project.repo.replace('https://', '')}
                      </a>
                    </td>
                  )}
                  {visibleColumns.includes('Team') && (
                    <td className="p-3 align-middle whitespace-nowrap text-white/60">
                      {project.team}
                    </td>
                  )}
                  {visibleColumns.includes('Tech') && (
                    <td className="p-3 align-middle whitespace-nowrap text-white/60">
                      {project.tech}
                    </td>
                  )}
                  {visibleColumns.includes('Created At') && (
                    <td className="p-3 align-middle whitespace-nowrap text-white/40">
                      {project.createdAt}
                    </td>
                  )}
                  {visibleColumns.includes('Contributors') && (
                    <td className="p-3 align-middle min-w-[120px]">
                      <div className="flex -space-x-2">
                        <TooltipProvider>
                          {project.contributors.map((contributor, idx) => (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <Avatar className="h-7 w-7 ring-2 ring-[#050505] hover:z-10 cursor-default">
                                  <AvatarImage
                                    src={contributor.avatar}
                                    alt={contributor.name}
                                  />
                                  <AvatarFallback className="bg-orange-500/[0.08] text-orange-400 text-xs border-[0.5px] border-orange-500/20">
                                    {contributor.name[0]}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent className="bg-[#050505] border-[0.5px] border-white/[0.06] text-white rounded-sm">
                                <p className="font-semibold text-xs">
                                  {contributor.name}
                                </p>
                                <p className="text-[11px] text-white/40">
                                  {contributor.email}
                                </p>
                                <p className="text-[11px] text-orange-400 italic">
                                  {contributor.role}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </TooltipProvider>
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes('Status') && (
                    <td className="p-3 align-middle whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border-[0.5px]',
                          statusClasses(project.status)
                        )}
                      >
                        {project.status}
                      </span>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr className="border-b border-white/[0.06]">
                <td
                  colSpan={visibleColumns.length}
                  className="p-3 text-center py-8 text-white/40"
                >
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ContributorsTable;
