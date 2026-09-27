import React from 'react';

interface FooterShadowFlowProps {
  techStack?: string[];
  showTechStack?: boolean;
  className?: string;
}

const FooterShadowFlow: React.FC<FooterShadowFlowProps> = ({
  techStack = ["React", "TypeScript", "Supabase", "Tailwind"],
  showTechStack = true,
  className = ""
}) => {
  return (
    <footer className={`bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 border-t dark:border-gray-700 ${className}`}>
      <div className="w-full px-4 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 max-w-full text-xs text-gray-500 text-center px-1">
          <span className="text-gray-300 font-medium shrink-0">Gerenciador de Chamados</span>
          {showTechStack && techStack.length > 0 && (
            <>
              {techStack.map((tech, index) => (
                <span key={index} className="px-2 py-1 bg-gray-800 rounded-full shrink-0">
                  {tech}
                </span>
              ))}
            </>
          )}
          <span className="shrink-0">© {new Date().getFullYear()} ShadowFlow Technologies</span>
        </div>
      </div>
    </footer>
  );
};

export default FooterShadowFlow;