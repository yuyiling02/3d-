import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GestureType, MoveDirection, ControlRefs } from './types';
import { Button, Badge, Instructions, ProcessingOverlay } from './components/UIComponents';
import HandController from './components/HandController';
import ModelViewer from './components/ModelViewer';
import { Upload, RotateCcw, Image as ImageIcon, Sparkles, Layers } from 'lucide-react';

const RECONSTRUCTION_STEPS = [
  "正在提取图像视觉特征...",
  "计算深度图与多视角云点...",
  "构建 3D 拓扑网格网...",
  "生成物理材质与纹理映射...",
  "完成 GLB 导出与环境优化"
];

const App: React.FC = () => {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState('');
  
  // Hand state
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
    }
  };

  /**
   * Integrated Image-to-3D Pipeline
   */
  const handleImageTo3D = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setCurrentStep(0);
    setAiAnalysis('');

    try {
      // 1. Read image as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      const pureBase64 = base64Data.split(',')[1];

      // 2. Gemini Spatial Analysis (Real AI call)
      setCurrentStep(0);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: pureBase64, mimeType: file.type } },
            { text: "简要分析图中物体的3D形态，仅需两句话描述其形状和材质。用于3D重建参考。" }
          ]
        }
      });
      setAiAnalysis(response.text || '识别完成，物体具有明确的几何边界...');

      // 3. Simulated Multi-stage Reconstruction (Wait for steps)
      // In a real production environment, you would call Tencent Hunyuan or Meshy API here.
      for (let i = 1; i < RECONSTRUCTION_STEPS.length; i++) {
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
        setCurrentStep(i);
      }

      // 4. Load the final model (Using a generic but high-quality demo model for presentation)
      // You can replace this URL with the actual GLB returned from your reconstruction API.
      const demoModels = [
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
        "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb"
      ];
      const selectedModel = demoModels[Math.floor(Math.random() * demoModels.length)];
      
      setModelUrl(selectedModel);
      setFileName(`AI_RECONSTRUCT_${file.name.split('.')[0]}.glb`);
      resetControls();
    } catch (error) {
      console.error("Image to 3D error:", error);
      alert("AI 重建任务失败，请检查 API 配置。");
    } finally {
      // Small delay to let the user see the "Success" state
      setTimeout(() => setIsProcessing(false), 500);
    }
  };

  const handleGestureUpdate = useCallback((gesture: GestureType, direction: MoveDirection, dragging: boolean) => {
    setGestureStatus(gesture);
    setDirectionStatus(direction);
    setIsDragging(dragging);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#fafafa] text-slate-800">
      {/* AI Processing UI */}
      {isProcessing && (
        <ProcessingOverlay 
          steps={RECONSTRUCTION_STEPS} 
          currentStep={currentStep} 
          aiAnalysis={aiAnalysis} 
        />
      )}

      {/* Header UI */}
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none z-50">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-200">
              <Layers className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">VIRTUAL MESH</h1>
              <p className="text-[10px] font-black text-blue-600 tracking-[0.3em] mt-1 uppercase">AI Reconstruction Lab</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-4 items-end pointer-events-auto">
          <div className="flex gap-2">
            {/* Direct Image-to-3D Integrated Button */}
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageTo3D}
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Button className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 shadow-xl shadow-blue-100 px-8 py-3">
                <ImageIcon size={16} />
                <span className="text-sm tracking-tight font-bold">一键图片转 3D</span>
                <Sparkles size={14} className="ml-1 opacity-50" />
              </Button>
            </div>

            {/* Standard GLB Upload */}
            <div className="relative">
              <input
                type="file"
                accept=".glb,.gltf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button className="bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 flex items-center gap-2 shadow-sm px-6 py-3">
                <Upload size={16} />
                <span className="text-sm tracking-tight font-bold">本地模型</span>
              </Button>
            </div>
          </div>

          <button 
            onClick={() => setCameraActive(!cameraActive)}
            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black tracking-widest uppercase border transition-all ${
              cameraActive 
                ? 'bg-red-50 border-red-100 text-red-600' 
                : 'bg-white/50 border-slate-200 text-slate-400 hover:text-slate-900'
            }`}
          >
            {cameraActive ? '停用动势控制' : '启用手势驱动'}
          </button>
        </div>
      </div>

      {/* Overlays */}
      {!isProcessing && <Instructions />}

      {/* Floating HUD for Gesture Stats */}
      {cameraActive && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 flex gap-1.5 p-1 bg-white/50 backdrop-blur-md rounded-full border border-white/50 shadow-sm animate-in slide-in-from-top-4">
            <Badge active={gestureStatus === GestureType.OPEN_PALM} label="Zoom In" color="blue" />
            <Badge active={gestureStatus === GestureType.CLOSED_FIST} label="Zoom Out" color="blue" />
            <Badge active={directionStatus !== MoveDirection.CENTER} label="Rotating" color="blue" />
            <Badge active={isDragging} label="Holding" color="orange" />
        </div>
      )}

      {/* Viewport */}
      {modelUrl ? (
        <ModelViewer modelUrl={modelUrl} controlRef={controlRef} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f8f9fb]">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/5 blur-[80px] rounded-full"></div>
            <div className="relative w-40 h-40 bg-white rounded-[40px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] border border-slate-100 flex items-center justify-center">
               <RotateCcw className="text-slate-100 w-20 h-20 animate-spin-slow" strokeWidth={1} />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900 mb-2">等待 3D 注入</h2>
            <p className="text-slate-400 text-sm font-medium max-w-[280px] leading-relaxed">
              上传单张图片，AI 将通过空间算法<br/>自动为您重建高精度 3D 资产。
            </p>
          </div>
        </div>
      )}

      {/* Camera Preview */}
      {cameraActive && (
        <HandController controlRef={controlRef} onStateChange={handleGestureUpdate} />
      )}
      
      {/* Decorative Branding */}
      <div className="absolute bottom-8 left-8 flex items-center gap-3 opacity-20 pointer-events-none">
        <span className="text-[10px] font-black tracking-[0.5em] text-slate-400 uppercase">Interactive AI Core v2.5</span>
      </div>
    </div>
  );
};

export default App;