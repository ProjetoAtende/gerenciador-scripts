import { motion } from "framer-motion";
import { WifiOff } from "lucide-react";

interface LogoutModalProps {
  isVisible: boolean;
}

export const LogoutModal = ({ isVisible }: LogoutModalProps) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-sm mx-4 text-center"
      >
        {/* Ícone animado */}
        <div className="mb-6 flex justify-center">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative"
          >
            {/* Wifi desconectando */}
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <WifiOff className="text-red-500" size={48} />
            </motion.div>
          </motion.div>
        </div>

        {/* Texto principal */}
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Desconectando...
        </h3>
        
        {/* Texto descritivo */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Finalizando sessão e desconectando dos serviços
        </p>

        {/* Barra de progresso animada */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
          <motion.div
            className="bg-blue-500 h-2 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "easeOut" }}
          />
        </div>

        {/* Pontos animados */}
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-blue-500 rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3
              }}
            />
          ))}
        </div>

        {/* Texto de instrução */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Aguarde, não feche esta janela
        </p>
      </motion.div>
    </motion.div>
  );
};