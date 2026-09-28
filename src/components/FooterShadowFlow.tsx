import React from 'react';

interface FooterShadowFlowProps {
  className?: string;
}

const FooterShadowFlow: React.FC<FooterShadowFlowProps> = ({ className = '' }) => {
  return (
    <footer
      className={`border-t border-gray-700/50 bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 ${className}`}
    >
      <div className="flex w-full items-center justify-center px-3 py-1.5">
        <span className="text-[11px] leading-tight text-gray-400">ShadowFlow Technologies 2026</span>
      </div>
    </footer>
  );
};

export default FooterShadowFlow;
