import React from 'react';

interface PolaroidProps {
  imageSrc?: string;
  caption?: string;
  rotation?: string;
  children?: React.ReactNode;
  className?: string;
}

export const Polaroid: React.FC<PolaroidProps> = ({ imageSrc, caption, rotation = 'rotate-0', children, className = '' }) => {
  return (
    <div className={`bg-white p-2 pb-8 shadow-sm border border-gray-100 transform ${rotation} transition-transform hover:scale-[1.02] hover:z-10 relative ${className}`}>
      <div className="bg-gray-50 aspect-square w-full overflow-hidden flex items-center justify-center relative">
        {imageSrc ? (
          <img src={imageSrc} alt="Polaroid content" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-300 font-hand-cn text-sm p-4 text-center">
             繪製中...
          </div>
        )}
        {children}
      </div>
      {caption && (
        <div className="absolute bottom-2 left-0 right-0 text-center px-1">
            <p className="font-hand-cn text-ink-dark text-lg truncate">{caption}</p>
        </div>
      )}
    </div>
  );
};
