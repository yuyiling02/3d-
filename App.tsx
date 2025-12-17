import React, { useState, useRef, useCallback } from 'react';
import { GestureType, MoveDirection, ControlRefs } from './types';
import { Button, Badge, Instructions } from './components/UIComponents';
import HandController from './components/HandController';
import ModelViewer from './components/ModelViewer';
import { Upload, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  
  // Real-time state for UI feedback
  const [gestureStatus, setGestureStatus] = useState<GestureType>(GestureType.NONE);
  const [directionStatus, setDirectionStatus] = useState<MoveDirection>(MoveDirection.CENTER);
  const [isDragging, setIsDragging] = useState(false);

  // Mutable ref for high-frequency updates between HandController and ModelViewer
  const controlRef = useRef<ControlRefs>({
    rotationSpeed: 0,
    zoomSpeed: 0,
    panPosition: { x: 0, y: 0 },
    isDragging: false
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setModelUrl(url);
      setFileName(file.name);
      // Reset controls
      controlRef.current = { 
        rotationSpeed: 0, 
        zoomSpeed: 0,
        panPosition: { x: 0, y: 0 },
        isDragging: false
      };
    }
  };

  const handleGestureUpdate = useCallback((gesture: GestureType, direction: MoveDirection, dragging: boolean) => {
    setGestureStatus(gesture);
    setDirectionStatus(direction);
    setIsDragging(dragging);
  }, []);

  const toggleCamera = () => {
    setCameraActive(!cameraActive);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden text-slate-800 font-sans">
      {/* Header / Top Bar */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-50">
        <div className="pointer-events-auto">
          <h1 className="text-2xl font-bold tracking-tight mb-1 text-slate-900">Gesture 3D</h1>
          <p className="text-slate-500 text-sm">双手动势控制模型浏览器</p>
        </div>
        
        <div className="flex flex-col gap-3 items-end pointer-events-auto">
          {/* File Upload Button */}
          <div className="relative">
            <input
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button className="bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2 shadow-lg">
              <Upload size={18} />
              {modelUrl ? '更换模型' : '上传 GLB 模型'}
            </Button>
          </div>
          {fileName && <span className="text-xs text-slate-500 bg-white/50 px-2 py-1 rounded-md">{fileName}</span>}

          {/* Camera Toggle */}
          <Button 
            onClick={toggleCamera}
            className={`flex items-center gap-2 shadow-md border ${
              cameraActive 
                ? 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {cameraActive ? '关闭摄像头' : '开启手势控制'}
          </Button>
        </div>
      </div>

      {/* Instructions Overlay */}
      <Instructions />

      {/* Status Indicators */}
      {cameraActive && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-40">
           {/* Left Hand Status */}
           <div className="flex gap-2">
            <Badge 
              active={gestureStatus === GestureType.OPEN_PALM} 
              label="左手: 放大"
              color="blue" 
            />
            <Badge 
              active={gestureStatus === GestureType.CLOSED_FIST} 
              label="左手: 缩小" 
              color="blue"
            />
            <Badge 
              active={directionStatus !== MoveDirection.CENTER} 
              label={directionStatus === MoveDirection.LEFT ? "左手: 左旋" : "左手: 右旋"} 
              color="blue"
            />
           </div>
           {/* Right Hand Status */}
           <div className="flex gap-2">
             <Badge 
              active={isDragging} 
              label={isDragging ? "右手: 正在拖拽" : "右手: 待机中"} 
              color="orange"
            />
           </div>
        </div>
      )}

      {/* Main Content Area */}
      {modelUrl ? (
        <ModelViewer modelUrl={modelUrl} controlRef={controlRef} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 m-4 rounded-3xl">
          <div className="text-center space-y-4 max-w-md p-8">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
               <RotateCcw className="text-slate-300 w-10 h-10 animate-spin-slow" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700">等待模型上传</h2>
            <p className="text-slate-500">
              请上传 .glb 格式的 3D 模型文件。上传后开启摄像头即可体验双手动势控制。
            </p>
          </div>
        </div>
      )}

      {/* Hand Controller Component (Hidden logic, Visible camera preview) */}
      {cameraActive && (
        <HandController controlRef={controlRef} onStateChange={handleGestureUpdate} />
      )}
    </div>
  );
};

export default App;