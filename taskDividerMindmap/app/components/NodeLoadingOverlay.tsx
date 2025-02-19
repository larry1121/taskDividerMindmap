import { motion } from "framer-motion";

const NodeLoadingOverlay = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-md flex items-center justify-center z-50"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-blue-500 animate-spin origin-[50%_66.66%]" />
        <span className="text-sm text-blue-600 font-medium">확장 중...</span>
      </div>
    </motion.div>
  );
};

export default NodeLoadingOverlay; 