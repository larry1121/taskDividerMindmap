import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface StatusUpdaterProps {
  status: 'not_started' | 'in_progress' | 'done' | 'skipped';
  onStatusChange: (newStatus: 'not_started' | 'in_progress' | 'done' | 'skipped') => void;
}

const statusConfig = {
  not_started: { color: 'bg-gray-300', text: '시작 전' },
  in_progress: { color: 'bg-yellow-500', text: '진행중' },
  done: { color: 'bg-green-500', text: '완료' },
  skipped: { color: 'bg-black', text: '건너뜀' }
};

const StatusUpdater: React.FC<StatusUpdaterProps> = ({ status, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-flex rounded-md border border-gray-300">
      <span className="inline-flex cursor-default items-center p-1 px-2 text-sm text-black">
        <span className="flex h-2 w-2">
          <span className={`relative inline-flex h-2 w-2 rounded-full ${statusConfig[status].color}`}></span>
        </span>
        <span className="ml-2 capitalize">{statusConfig[status].text}</span>
      </span>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex cursor-pointer items-center rounded-br-md rounded-tr-md border-l border-l-gray-300 bg-gray-100 p-1 px-2 text-sm text-black hover:bg-gray-200"
      >
        <span className="mr-0.5">상태 변경</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 flex min-w-[160px] flex-col divide-y rounded-md border border-gray-200 bg-white shadow-md z-50">
          <button 
            onClick={() => {
              onStatusChange('in_progress');
              setIsOpen(false);
            }}
            className="inline-flex justify-between px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100"
          >
            <span>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-yellow-500"></span>
              진행중
            </span>
          </button>
          <button 
            onClick={() => {
              onStatusChange('done');
              setIsOpen(false);
            }}
            className="inline-flex justify-between px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100"
          >
            <span>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-500"></span>
              완료
            </span>
          </button>
          <button 
            onClick={() => {
              onStatusChange('skipped');
              setIsOpen(false);
            }}
            className="inline-flex justify-between px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100"
          >
            <span>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-black"></span>
              건너뜀
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default StatusUpdater; 