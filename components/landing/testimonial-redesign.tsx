'use client';

import { motion } from 'framer-motion';

export const TestimonialRedesign = () => {
  return (
    <section className="py-24 relative overflow-hidden px-4 md:px-8">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-16">
          Trusted by top-tier agencies.
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              quote: "Synthex entirely replaced our social team. It's like having a senior copywriter on call 24/7.",
              author: "Elena R.",
              role: "Head of Marketing, Nexus",
            },
            {
              quote: "The brand voice extraction is uncanny. It sounds more like our founder than the founder does.",
              author: "David K.",
              role: "Founder, Elevate",
            },
            {
              quote: "Our engagement went up 400% in the first month because of the auto-timing and virality scores.",
              author: "Sarah J.",
              role: "Director, SocialSphere",
            }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 1, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="p-8 rounded-3xl bg-midnight-900/50 border border-midnight-700 backdrop-blur-sm shadow-xl text-left"
            >
               <div className="flex gap-1 mb-6">
                 {[1, 2, 3, 4, 5].map((star) => (
                   <svg key={star} className="w-5 h-5 text-aurora-cyan" fill="currentColor" viewBox="0 0 20 20">
                     <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                   </svg>
                 ))}
               </div>
               <p className="text-midnight-300 text-lg mb-6">&ldquo;{item.quote}&rdquo;</p>
               <div>
                 <p className="text-white font-bold">{item.author}</p>
                 <p className="text-midnight-500 text-sm">{item.role}</p>
               </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
