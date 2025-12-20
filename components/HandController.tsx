import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { ControlRefs, GestureType, MoveDirection } from '../types';

interface HandControllerProps {
  controlRef: React.MutableRefObject<ControlRefs>;
  onStateChange: (gesture: GestureType, direction: MoveDirection, isDragging: boolean) => void;
}

const HandController: React.FC<HandControllerProps> = ({ controlRef, onStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // Constants
  const ROTATION_THRESHOLD_LEFT = 0.3;
  const ROTATION_THRESHOLD_RIGHT = 0.7;
  const PINCH_THRESHOLD = 0.05;

  useEffect(() => {
    let mounted = true;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        if (!mounted) return;

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        startWebcam();
      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
        setError("AI 引擎加载失败");
        setLoading(false);
      }
    };

    setupMediaPipe();

    return () => {
      mounted = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240, facingMode: "user" } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
      }
      setLoading(false);
    } catch (err) {
      console.error("Webcam error:", err);
      setError("无法访问摄像头");
      setLoading(false);
    }
  };

  const predictWebcam = () => {
    if (!videoRef.current || !handLandmarkerRef.current || !canvasRef.current) return;

    const startTimeMs = performance.now();
    const result = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvasRef.current.width, 0);
      
      let newRotSpeed = 0;
      let newZoomSpeed = 0;
      let newDirection = MoveDirection.CENTER;
      let newGesture = GestureType.NONE;
      let isDragging = false;

      if (result.landmarks && result.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        
        for (let i = 0; i < result.landmarks.length; i++) {
          const landmarks = result.landmarks[i];
          const handedness = result.handedness[i][0].categoryName; 

          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: handedness === "Left" ? "#86e3ce" : "#ffddca", 
            lineWidth: 3
          });
          drawingUtils.drawLandmarks(landmarks, { 
            color: "#ffffff", 
            lineWidth: 1, 
            radius: 2 
          });

          if (handedness === "Left") {
            const wristX = landmarks[0].x;
            if (wristX < ROTATION_THRESHOLD_LEFT) {
                newDirection = MoveDirection.LEFT;
                newRotSpeed = -0.015; 
            } else if (wristX > ROTATION_THRESHOLD_RIGHT) {
                newDirection = MoveDirection.RIGHT;
                newRotSpeed = 0.015;
            }

            if (isFist(landmarks)) {
                newGesture = GestureType.CLOSED_FIST;
                newZoomSpeed = -0.01;
            } else if (isOpenPalm(landmarks)) {
                newGesture = GestureType.OPEN_PALM;
                newZoomSpeed = 0.01;
            }
          }

          if (handedness === "Right") {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const distance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );

            if (distance < PINCH_THRESHOLD) {
                isDragging = true;
                const pinchX = (thumbTip.x + indexTip.x) / 2;
                const pinchY = (thumbTip.y + indexTip.y) / 2;
                const viewScaleX = 6;
                const viewScaleY = 4;
                const targetX = (0.5 - pinchX) * viewScaleX; 
                const targetY = (0.5 - pinchY) * viewScaleY;
                controlRef.current.panPosition = { x: targetX, y: targetY };
            }
          }
        }
      }

      controlRef.current.rotationSpeed = newRotSpeed;
      controlRef.current.zoomSpeed = newZoomSpeed;
      controlRef.current.isDragging = isDragging;
      onStateChange(newGesture, newDirection, isDragging);
      ctx.restore();
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const isFist = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const tips = [8, 12, 16, 20];
      let totalDist = 0;
      tips.forEach(idx => {
          totalDist += Math.sqrt(Math.pow(landmarks[idx].x - wrist.x, 2) + Math.pow(landmarks[idx].y - wrist.y, 2));
      });
      const avgDist = totalDist / 4;
      const handSize = Math.sqrt(Math.pow(landmarks[5].x - wrist.x, 2) + Math.pow(landmarks[5].y - wrist.y, 2));
      return (avgDist / handSize) < 0.9;
  };

  const isOpenPalm = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const tips = [8, 12, 16, 20];
      let totalDist = 0;
      tips.forEach(idx => {
          totalDist += Math.sqrt(Math.pow(landmarks[idx].x - wrist.x, 2) + Math.pow(landmarks[idx].y - wrist.y, 2));
      });
      const avgDist = totalDist / 4;
      const handSize = Math.sqrt(Math.pow(landmarks[5].x - wrist.x, 2) + Math.pow(landmarks[5].y - wrist.y, 2));
      return (avgDist / handSize) > 1.4;
  };

  if (error) return <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-400 text-[10px] font-black">{error}</div>;

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest">
          Initializing AI...
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform -scale-x-100" 
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        width={320}
        height={240}
      />
    </div>
  );
};

export default HandController;