import React from 'react';
import { Loader2, Sparkles, CheckCircle2, Circle } from 'lucide-react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button
    className={`px-6 py-2 rounded-full font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Badge: React.FC<{ active: boolean; label: string; color?: string }> = ({ active, label, color = 'emerald' }) => {
  const activeClass = `bg-${color}-100 text-${color}-700 border-${color}-200 shadow-sm`;
  const inactiveClass = 'bg-slate-50 text-slate-300 border-slate-100';
  
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-300 border ${
      active ? activeClass : inactiveClass
    }`}>
      {label}
    </span>
  );
};

export const ProcessingOverlay: React.FC<{ steps: string[], currentStep: number, aiAnalysis?: string }> = ({ steps, currentStep, aiAnalysis }) => (
  <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-2xl flex flex-col items-center justify-center transition-all duration-700 animate-in fade-in">
    <div className="relative mb-12">
      <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full animate-pulse"></div>
      <div className="relative bg-white p-10 rounded-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-slate-100">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin" strokeWidth={1.5} />
      </div>
    </div>
    
    <div className="max-w-md w-full px-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight flex items-center justify-center gap-2">
          <Sparkles className="text-amber-400 w-6 h-6 animate-bounce" />
          AI 重建引擎
        </h2>
        <p className="text-slate-400 font-medium">正在将 2D 像素转化为 3D 空间几何</p>
      </div>

      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div key={idx} className={`flex items-center gap-3 transition-all duration-500 ${idx === currentStep ? 'opacity-100 scale-105' : idx < currentStep ? 'opacity-50' : 'opacity-20'}`}>
            {idx < currentStep ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : idx === currentStep ? (
              <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
            ) : (
              <Circle className="w-5 h-5 text-slate-300" />
            )}
            <span className={`text-sm font-bold ${idx === currentStep ? 'text-blue-600' : 'text-slate-600'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>

      {aiAnalysis && (
        <div className="mt-8 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 animate-in slide-in-from-bottom-4">
          <p className="text-[11px] font-mono text-blue-700 leading-relaxed italic">
            <span className="font-bold mr-1">AI_ANALYSIS_LOG:</span>
            {aiAnalysis}
          </p>
        </div>
      )}
    </div>
  </div>
);

export const Instructions: React.FC = () => (
  <div className="absolute top-24 left-4 z-10 bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/50 max-w-[240px]">
    <h3 className="text-xs font-black text-slate-400 mb-4 uppercase tracking-[0.2em]">控制说明</h3>
    
    <div className="space-y-6">
      <div>
        <h4 className="text-[10px] font-black text-blue-600 mb-2 uppercase tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
          左手 (相机)
        </h4>
        <ul className="text-xs text-slate-600 font-bold space-y-2">
          <li>张开 / 握拳 <span className="text-slate-300 ml-1">→</span> 缩放</li>
          <li>横向移动 <span className="text-slate-300 ml-1">→</span> 旋转</li>
        </ul>
      </div>

      <div>
        <h4 className="text-[10px] font-black text-orange-600 mb-2 uppercase tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
          右手 (位置)
        </h4>
        <ul className="text-xs text-slate-600 font-bold space-y-2">
          <li>手指捏合 <span className="text-slate-300 ml-1">→</span> 拖拽</li>
        </ul>
      </div>
    </div>
  </div>
);