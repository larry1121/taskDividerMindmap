import React from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";

const MindMapLegend: React.FC = () => {
  const legendItems = [
    { icon: "🔍", text: "노드를 클릭하여 상세 정보 확인" },
    { icon: "↕️", text: "화살표로 노드 확장/축소" },
    { icon: "🖱️", text: "우클릭으로 관련 주제 탐색" },
    { icon: "🔄", text: "마우스 휠로 확대/축소" },
    { icon: "✋", text: "드래그로 지도 이동" },
    { icon: "💾", text: "JSON/Markdown으로 저장" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4 p-2 bg-blue-50 rounded-lg">
        <Info className="w-4 h-4 text-blue-500" />
        <span className="text-sm text-blue-700">마인드맵 사용 가이드</span>
      </div>
      <ul className="space-y-3">
        {legendItems.map((item, index) => (
          <motion.li
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg
            transition-colors duration-200"
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm text-gray-700">{item.text}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};

export default MindMapLegend;
