
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GestureType, MoveDirection, ControlRefs } from './types';
import { Badge, ProcessingOverlay } from './components/UIComponents';
import HandController from './components/HandController';
import ModelViewer from './components/ModelViewer';
import VoiceController from './components/VoiceController';
import { Upload, Sparkles, Box, Atom, Dna, Calculator, ChevronDown, MessageSquare } from 'lucide-react';

const RECONSTRUCTION_STEPS = [
  "正在提取教具视觉特征...",
  "计算空间拓扑结构...",
  "构建 3D 教材网格...",
  "渲染物理贴图...",
  "导出交互式 GLB 模型"
];

const App: React.FC = () => {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(true);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState('等待指令中...');
  
  // Hand/Voice state
  const [gestureStatus, setGestureStatus] = useState<GestureType>(GestureType.NONE);
  const [directionStatus, setDirectionStatus] = useState<MoveDirection>(MoveDirection.CENTER);
  const [isDragging, setIsDragging] = useState(false);

  const controlRef = useRef<ControlRefs>({
    rotationSpeed: 0,
    zoomSpeed: 0,
    panPosition: { x: 0, y: 0 },
    isDragging: false
  });

  const resetControls = () => {
    controlRef.current = { 
      rotationSpeed: 0, 
      zoomSpeed: 0,
      panPosition: { x: 0, y: 0 },
      isDragging: false
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setModelUrl(url);
      setFileName(file.name);
      resetControls();
      setAiAnalysis(`成功加载本地模型: ${file.name}`);
    }
  };

  const loadDemoModel = (url: string, name: string) => {
    setModelUrl(url);
    setFileName(name);
    resetControls();
    setAiAnalysis(`正在演示: ${name}`);
  };

  const handleImageTo3D = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setCurrentStep(0);
    setAiAnalysis('AI 正在扫描图片...');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      const pureBase64 = base64Data.split(',')[1];

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: pureBase64, mimeType: file.type } },
            { text: "简要分析图中教具的3D形态，仅需两句话描述其形状和材质。这将被用于教育场景下的3D重建。" }
          ]
        }
      });
      setAiAnalysis(response.text || '已识别教学目标，正在开始 3D 转换...');

      for (let i = 1; i < RECONSTRUCTION_STEPS.length; i++) {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
        setCurrentStep(i);
      }

      const demoModels = [
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb"
      ];
      const selectedModel = demoModels[Math.floor(Math.random() * demoModels.length)];
      
      setModelUrl(selectedModel);
      setFileName(`EDU_3D_${file.name.split('.')[0]}.glb`);
      resetControls();
    } catch (error) {
      console.error("AI Reconstruction Error:", error);
      setAiAnalysis("AI 分析失败，请检查网络或配置。");
    } finally {
      setTimeout(() => setIsProcessing(false), 500);
    }
  };

  const handleGestureUpdate = useCallback((gesture: GestureType, direction: MoveDirection, dragging: boolean) => {
    setGestureStatus(gesture);
    setDirectionStatus(direction);
    setIsDragging(dragging);
  }, []);

  return (
    <div className="flex flex-col h-screen text-slate-700">
      {/* 顶部导航 */}
      <nav className="h-20 px-8 flex items-center justify-between z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#86e3ce] rounded-full flex items-center justify-center text-white shadow-lg animate-pulse">
            <Box size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-gray-700 tracking-tight">慧视课堂</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest -mt-1">AI 沉浸式教学系统</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageTo3D}
              disabled={isProcessing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <button className="px-6 py-2 rounded-full glass-panel text-gray-600 hover:bg-white flex items-center transition-all hover:scale-105 active:scale-95 shadow-sm">
              <Sparkles className="mr-2 text-[#86e3ce]" size={18} /> 图片转 3D
            </button>
          </div>

          <div className="relative group">
            <input
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <button className="px-6 py-2 rounded-full glass-panel text-gray-400 hover:text-gray-600 flex items-center transition-all">
              <Upload className="mr-2" size={16} /> 本地模型
            </button>
          </div>

          <div className="w-11 h-11 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
            <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Felix" alt="avatar" />
          </div>
        </div>
      </nav>

      {/* 主体区域 */}
      <main className="flex-1 flex px-6 pb-6 space-x-6 overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-72 glass-panel rounded-[32px] p-6 flex flex-col space-y-8 animate-in slide-in-from-left-8 duration-700">
          <div>
            <h3 className="font-black text-xs text-gray-400 uppercase tracking-[0.2em] mb-4 border-l-4 border-[#86e3ce] pl-3">学科资源库</h3>
            <div className="space-y-1">
              <div onClick={() => loadDemoModel("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb", "原子结构模型")} className="sidebar-item p-3 rounded-2xl flex items-center text-sm font-bold text-gray-600">
                <Atom className="mr-3 text-blue-400" size={18} /> 物理化学模型
              </div>
              <div className="sidebar-item p-3 rounded-2xl flex items-center text-sm font-bold text-gray-600 opacity-60">
                <Dna className="mr-3 text-green-400" size={18} /> 生物教具展示
              </div>
              <div className="sidebar-item p-3 rounded-2xl flex items-center text-sm font-bold text-gray-600 opacity-60">
                <Calculator className="mr-3 text-orange-400" size={18} /> 空间几何结构
              </div>
              <div className="flex items-center justify-center pt-2 text-gray-300">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black text-xs text-gray-400 uppercase tracking-[0.2em] mb-4 border-l-4 border-pink-300 pl-3">交互智能控制</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/40 border border-white/50">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">交互绑定</p>
                <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center text-xs">
                     <span className="font-bold">手势</span>
                     <span className="text-[#86e3ce]">旋转 + 缩放</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                     <span className="font-bold">语音</span>
                     <span className="text-pink-400">指令识别 (Gemini)</span>
                   </div>
                </div>
              </div>
              <button 
                onClick={() => setCameraActive(!cameraActive)}
                className={`w-full py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase border transition-all ${
                  cameraActive 
                    ? 'bg-red-50 border-red-100 text-red-600' 
                    : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                }`}
              >
                {cameraActive ? '停用摄像头' : '启用手势捕捉'}
              </button>
            </div>
          </div>

          <div className="mt-auto">
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-blue-400" />
                <p className="text-[10px] text-blue-400 font-bold uppercase">助教日志</p>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium italic min-h-[3em]">
                "{aiAnalysis}"
              </p>
            </div>
          </div>
        </aside>

        {/* 视口展示区 */}
        <section className="flex-1 glass-panel rounded-[32px] relative overflow-hidden group">
          {isProcessing && (
            <ProcessingOverlay 
              steps={RECONSTRUCTION_STEPS} 
              currentStep={currentStep} 
              aiAnalysis={aiAnalysis} 
            />
          )}

          {/* 语音智控按钮 */}
          <div className="absolute bottom-6 left-6 z-50">
            <VoiceController 
              controlRef={controlRef} 
              onStatusChange={(msg) => setAiAnalysis(msg)} 
            />
          </div>

          <div className="absolute top-6 right-6 flex gap-2 z-40">
            <div className={`px-4 py-2 rounded-xl bg-white/80 backdrop-blur-md text-[10px] font-bold shadow-sm flex items-center gap-2 ${cameraActive ? 'text-emerald-500' : 'text-gray-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
              {cameraActive ? 'AI 动势追踪' : '手势已关闭'}
            </div>
          </div>

          {modelUrl ? (
            <ModelViewer modelUrl={modelUrl} controlRef={controlRef} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white/20">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-[#86e3ce]/10 blur-[80px] rounded-full"></div>
                <div className="relative w-40 h-40 bg-white/80 rounded-[40px] shadow-xl border border-white flex items-center justify-center">
                   <Box className="text-[#86e3ce] w-20 h-20 animate-spin-slow" strokeWidth={1} />
                </div>
              </div>
              <div className="text-center px-8">
                <h2 className="text-2xl font-black text-gray-700 mb-2">欢迎来到 3D AI 实验室</h2>
                <p className="text-gray-400 text-sm font-medium max-w-[320px] leading-relaxed">
                  您可以尝试说“请放大模型”或使用手势<br/>来交互探索微观世界的奥秘。
                </p>
              </div>
            </div>
          )}

          {/* 状态浮窗 */}
          {cameraActive && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex gap-1.5 p-1.5 bg-white/80 backdrop-blur-md rounded-full border border-white shadow-sm">
                <Badge active={gestureStatus === GestureType.OPEN_PALM || controlRef.current.zoomSpeed > 0} label="放大" color="blue" />
                <Badge active={gestureStatus === GestureType.CLOSED_FIST || controlRef.current.zoomSpeed < 0} label="缩小" color="blue" />
                <Badge active={directionStatus !== MoveDirection.CENTER || controlRef.current.rotationSpeed !== 0} label="旋转中" color="emerald" />
                <Badge active={isDragging} label="抓取模型" color="orange" />
            </div>
          )}

          {/* 摄像头预览区 */}
          {cameraActive && (
            <div className="absolute bottom-6 right-6 w-56 h-40 rounded-3xl border-4 border-white shadow-2xl overflow-hidden bg-black z-30 transition-all hover:scale-105">
               <HandController controlRef={controlRef} onStateChange={handleGestureUpdate} />
               <div className="absolute top-3 left-3 flex items-center gap-2">
                 <div className="bg-[#86e3ce] w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_#86e3ce]"></div>
                 <span className="text-[8px] font-black text-white/70 uppercase tracking-widest">Vision Sensor</span>
               </div>
            </div>
          )}
        </section>
      </main>

      <footer className="h-8 px-10 flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-widest font-bold bg-white/30 backdrop-blur-sm">
        <span>© 2025 慧视课堂 | 教育 AI 实验室</span>
        <div className="flex items-center gap-4">
           <span className="flex items-center gap-1 text-[#86e3ce]">
              <div className="w-1 h-1 bg-[#86e3ce] rounded-full animate-ping"></div>
              Gemini Live API 已接入
           </span>
           <span>v2.6.0-VOICE</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
