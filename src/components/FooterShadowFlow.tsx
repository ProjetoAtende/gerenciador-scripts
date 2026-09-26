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
        <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
          <span className="text-gray-300 font-medium">Gerenciador de Chamados</span>
          {showTechStack && techStack.length > 0 && (
            <>
              {techStack.map((tech, index) => (
                <span key={index} className="px-2 py-1 bg-gray-800 rounded-full">
                  {tech}
                </span>
              ))}
            </>
          )}
          <span>© {new Date().getFullYear()} ShadowFlow Technologies</span>
        </div>
      </div>
    </footer>
  );
};

export default FooterShadowFlow;