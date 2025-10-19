import { motion } from 'framer-motion';

interface AnalysisLoadingProps {
  show: boolean;
}

export default function AnalysisLoading({ show }: AnalysisLoadingProps) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-pink-50/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Pulsing brain icon */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="text-6xl"
        >
          🧠
        </motion.div>

        {/* Loading text */}
        <div className="text-center">
          <motion.p
            className="text-lg font-medium text-pink-900"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            Understanding your reflection...
          </motion.p>
          <p className="mt-2 text-sm text-pink-700">
            AI is analyzing emotional nuances
          </p>
        </div>

        {/* Animated progress dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-3 w-3 rounded-full bg-pink-400"
              animate={{
                y: [0, -10, 0],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Subtle hint */}
        <p className="text-xs text-pink-600/60">
          Phi-3 is thinking deeply about your words
        </p>
      </div>
    </motion.div>
  );
}
