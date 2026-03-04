import React from 'react';

interface WashiTapeProps {
  color?: string; // Tailwind class like 'bg-tape-red'
  className?: string;
  text?: string;
}

export const WashiTape: React.FC<WashiTapeProps> = ({ color = 'bg-tape-red', className = '', text }) => {
  return (
    <div 
      className={`absolute h-8 min-w-[100px] flex items-center justify-center px-4 ${color} opacity-90 shadow-sm z-20 ${className}`}
      style={{
        maskImage: 'linear-gradient(90deg, transparent 0%, black 2%, black 98%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 2%, black 98%, transparent 100%)', // Rough edges simulation
        clipPath: 'polygon(2% 0, 100% 0, 98% 100%, 0% 100%)' // Slight perspective/tear
      }}
    >
      {text && <span className="font-hand text-white text-lg tracking-widest">{text}</span>}
    </div>
  );
};
