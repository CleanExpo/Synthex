'use client';

import { motion, AnimatePresence } from 'framer-motion';
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

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  hover: {
    y: -2,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const expandedContentVariants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.3,
      ease: [0.04, 0.62, 0.23, 0.98] as [number, number, number, number],
    },
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      duration: 0.4,
      ease: [0.04, 0.62, 0.23, 0.98] as [number, number, number, number],
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
  },
};

const pillVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
  },
  hover: {
    scale: 1.05,
    y: -1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
  },
  tap: { scale: 0.98 },
};

const logoVariants = {
  hover: {
    scale: 1.1,
    rotate: 5,
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
  },
};

const chevronVariants = {
  hover: {
    scale: 1.1,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
  },
  tap: { scale: 0.95 },
};

function ProjectCard({ project }: { project: Project }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className={cn(
        'border-b border-[0.5px] border-white/[0.06] py-4 cursor-pointer',
        'hover:bg-orange-500/[0.02] transition-colors duration-200'
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          {/* Logo */}
          <motion.div
            variants={logoVariants}
            whileHover="hover"
            className={cn(
              'w-12 h-12 rounded-sm flex items-center justify-center',
              'text-white text-lg font-semibold flex-shrink-0 shadow-sm',
              project.logoColor
            )}
          >
            {project.logoIcon}
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title and Status Row */}
            <motion.div
              className="flex items-center gap-3 mb-2"
              variants={childVariants}
            >
              <h3 className="font-semibold text-white text-sm">
                {project.title}
              </h3>
              <div className="w-px h-3 bg-white/20" />
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'px-2 py-0.5 rounded-sm text-xs font-medium transition-all duration-200',
                  project.status === 'Paid'
                    ? 'text-orange-400 bg-orange-500/[0.08] border-[0.5px] border-orange-500/20'
                    : 'text-white/60 bg-white/[0.04] border-[0.5px] border-white/[0.06]'
                )}
              >
                {project.status}
              </motion.span>
            </motion.div>

            {/* Price */}
            <motion.p
              className="text-white/60 text-sm mb-4 font-medium"
              variants={childVariants}
            >
              {project.pricePerHour}
            </motion.p>

            {/* Expandable Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  variants={expandedContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="overflow-hidden"
                >
                  {/* Category Pills */}
                  <motion.div
                    className="flex gap-2 mb-4 flex-wrap"
                    variants={childVariants}
                  >
                    {project.categories.map((category, index) => (
                      <motion.span
                        key={index}
                        variants={pillVariants}
                        whileHover="hover"
                        whileTap="tap"
                        custom={index}
                        className={cn(
                          'px-4 py-2 text-white/60 rounded-sm text-sm font-medium cursor-pointer select-none',
                          'border-[0.5px] border-white/[0.06] bg-white/[0.03]',
                          'hover:border-orange-500/20 hover:text-orange-400 transition-colors duration-200'
                        )}
                      >
                        {category}
                      </motion.span>
                    ))}
                  </motion.div>

                  {/* Description */}
                  <motion.p
                    className="text-white/50 text-sm leading-relaxed mb-4"
                    variants={childVariants}
                  >
                    {project.description}
                  </motion.p>

                  {/* Location and Time */}
                  <motion.div
                    className="flex items-center gap-2 text-sm text-white/40"
                    variants={childVariants}
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 25,
                      }}
                    >
                      <MapPin className="w-4 h-4 text-orange-400/60" />
                    </motion.div>
                    <span className="text-xs font-medium">
                      {project.location}
                    </span>
                    <div className="w-px h-3 bg-white/20 mx-1" />
                    <span className="text-xs">{project.timeAgo}</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Chevron Button */}
        <motion.button
          variants={chevronVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={e => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ml-3',
            'text-white/60 bg-white/[0.04] border-[0.5px] border-white/[0.06]',
            'hover:border-orange-500/20 transition-colors duration-200'
          )}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.button>
      </div>
    </motion.div>
  );
}

export function ProjectCards({ projects }: ProjectCardsProps) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {projects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              delay: index * 0.1 + 0.3,
              mass: 0.8,
            }}
          >
            <ProjectCard project={project} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export default ProjectCards;
