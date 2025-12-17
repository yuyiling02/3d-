import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button
    className={`px-6 py-2 rounded-full font-medium transition-all duration-200 active:scale-95 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Badge: React.FC<{ active: boolean; label: string; color?: string }> = ({ active, label, color = 'emerald' }) => {
  const activeClass = `bg-${color}-100 text-${color}-700 border-${color}-200`;
  const inactiveClass = 'bg-slate-100 text-slate-400 border-slate-200';
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-colors duration-300 border ${
      active ? activeClass : inactiveClass
    }`}>
      {label}
    </span>
  );
};

export const Instructions: React.FC = () => (
  <div className="absolute top-20 left-4 z-10 bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-lg border border-slate-100 max-w-xs">
    <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">双手动势控制指南</h3>
    
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-bold text-blue-600 mb-1 uppercase tracking-wider">左手 (Left Hand)</h4>
        <ul className="text-xs text-slate-600 space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span><b>张开手掌:</b> 放大模型</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span><b>握紧拳头:</b> 缩小模型</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span><b>手向左/右移:</b> 旋转模型</span>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="text-xs font-bold text-orange-600 mb-1 uppercase tracking-wider">右手 (Right Hand)</h4>
        <ul className="text-xs text-slate-600 space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span><b>拇指捏住食指:</b> 抓取并拖拽模型</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
);