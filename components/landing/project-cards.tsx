'use client';

import { ChevronDown, MapPin } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface Project {
  id: string;
  title: string;
  pricePerHour: string;
  status: 'Paid' | 'Not Paid';
  categories: string[];
  description: string;
  location: string;
  timeAgo: string;
  logoColor: string;
  logoIcon: string;
}

interface ProjectCardsProps {
  projects: Project[];
}

function ProjectCard({ project }: { project: Project }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        'border-b border-[0.5px] border-white/[0.06] py-4 cursor-pointer',
        'hover:bg-orange-500/[0.02] transition-colors duration-200'
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          {/* Logo */}
          <div
            className={cn(
              'w-12 h-12 rounded-sm flex items-center justify-center',
              'text-white text-lg font-semibold flex-shrink-0 shadow-sm hover:scale-110 transition-transform duration-200',
              project.logoColor
            )}
          >
            {project.logoIcon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title and Status Row */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-white text-sm">
                {project.title}
              </h3>
              <div className="w-px h-3 bg-white/20" />
              <span
                className={cn(
                  'px-2 py-0.5 rounded-sm text-xs font-medium transition-all duration-200',
                  project.status === 'Paid'
                    ? 'text-orange-400 bg-orange-500/[0.08] border-[0.5px] border-orange-500/20'
                    : 'text-white/60 bg-white/[0.04] border-[0.5px] border-white/[0.06]'
                )}
              >
                {project.status}
              </span>
            </div>

            {/* Price */}
            <p className="text-white/60 text-sm mb-4 font-medium">
              {project.pricePerHour}
            </p>

            {/* Expandable Content */}
            {isExpanded && (
              <div className="overflow-hidden">
                {/* Category Pills */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {project.categories.map((category, index) => (
                    <span
                      key={index}
                      className={cn(
                        'px-4 py-2 text-white/60 rounded-sm text-sm font-medium cursor-pointer select-none',
                        'border-[0.5px] border-white/[0.06] bg-white/[0.03]',
                        'hover:border-orange-500/20 hover:text-orange-400 transition-colors duration-200 hover:scale-105'
                      )}
                    >
                      {category}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  {project.description}
                </p>

                {/* Location and Time */}
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <div>
                    <MapPin className="w-4 h-4 text-orange-400/60" />
                  </div>
                  <span className="text-xs font-medium">
                    {project.location}
                  </span>
                  <div className="w-px h-3 bg-white/20 mx-1" />
                  <span className="text-xs">{project.timeAgo}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chevron Button */}
        <button
          onClick={e => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ml-3',
            'text-white/60 bg-white/[0.04] border-[0.5px] border-white/[0.06]',
            'hover:border-orange-500/20 hover:bg-orange-500/[0.15] transition-colors duration-200'
          )}
        >
          <div
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s',
            }}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
}

export function ProjectCards({ projects }: ProjectCardsProps) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div>
        {projects.map((project, index) => (
          <div key={project.id}>
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProjectCards;
