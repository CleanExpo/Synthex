'use client';

import { motion } from 'framer-motion';

const brutalFeatures = [
  {
    num: '01',
    title: 'Voice Extraction',
    description: 'Provide a URL and our AI instantly extracts your exact tone, style, and vocabulary.',
    color: 'bg-acid-pink',
    rotation: '-rotate-2'
  },
  {
    num: '02',
    title: 'Real-Time Scoring',
    description: 'Score content for virality before publishing. Stop guessing, start knowing.',
    color: 'bg-acid-yellow',
    rotation: 'rotate-1'
  },
  {
    num: '03',
    title: 'Cross-Platform',
    description: 'Auto-formats for 9 different social networks instantly. Absolute dominance.',
    color: 'bg-acid-green',
    rotation: '-rotate-1'
  },
  {
    num: '04',
    title: 'Auto-Scheduling',
    description: 'Smart timing based on audience active hours. We post while you sleep.',
    color: 'bg-acid-orange',
    rotation: 'rotate-2'
  },
];

export const BrutalistFeatures = () => {
  return (
    <section id="features" className="py-32 relative z-10 px-4 md:px-8 bg-white border-y-8 border-black">
      <div className="max-w-7xl mx-auto">
        <motion.div
           initial={{ opacity: 0, x: -50 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true, margin: '-100px' }}
           transition={{ duration: 0.6 }}
           className="mb-24 flex flex-col md:flex-row items-end justify-between border-b-8 border-black pb-8"
        >
           <h2 className="text-7xl md:text-9xl font-black text-black uppercase tracking-tighter leading-none mb-4 md:mb-0" style={{ textShadow: '8px 8px 0px #FFEA00' }}>
             Built to <br /> Break Rules.
           </h2>
           <p className="max-w-sm text-2xl font-bold border-l-8 border-black pl-6 py-2">
             A complete suite of AI tools designed exclusively for aggressive growth. No holds barred.
           </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {brutalFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 50, rotate: 0 }}
              whileInView={{ opacity: 1, y: 0, rotate: feature.rotation === 'rotate-1' ? 1 : feature.rotation === 'rotate-2' ? 2 : feature.rotation === '-rotate-1' ? -1 : -2 }}
              whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1, type: 'spring' }}
              className={`relative overflow-hidden p-8 border-4 border-black group transition-all duration-300 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${feature.color} text-black origin-center`}
            >
              <div className="mb-4">
                 <span className="text-8xl font-black opacity-20 block translate-y-4 tracking-tighter">{feature.num}</span>
              </div>
              <h3 className="text-3xl font-black uppercase mb-4 leading-tight bg-white inline-block px-2 border-2 border-black -translate-x-4 mix-blend-screen">{feature.title}</h3>
              <p className="text-xl font-bold leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
