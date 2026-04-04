'use client';

import { FC } from 'react';
import { cn } from '@/lib/utils';

interface TextRevealByWordProps {
  text: string;
  className?: string;
}

const TextRevealByWord: FC<TextRevealByWordProps> = ({ text, className }) => {
  const words = text.split(' ');

  return (
    <div className={cn('relative z-0 h-[200vh]', className)}>
      <div
        className={cn(
          'sticky top-0 mx-auto flex h-[50%] max-w-4xl items-center',
          'bg-transparent px-[1rem] py-[5rem]'
        )}
      >
        <p
          className={cn(
            'flex flex-wrap p-5',
            'text-2xl font-bold text-white/50',
            'md:p-8 md:text-3xl lg:p-10 lg:text-4xl xl:text-5xl'
          )}
        >
          {words.map((word, i) => (
            <span key={i} className="xl:lg-3 relative mx-1 lg:mx-2.5">
              <span className="text-white">{word}</span>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
};

export { TextRevealByWord };
export default TextRevealByWord;
