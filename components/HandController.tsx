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
  const PINCH_THRESHOLD = 0.05; // Normalized distance

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
          numHands: 2 // Enable detecting both hands
        });

        startWebcam();
      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
        setError("Failed to load gesture recognition engine.");
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
      setError("Camera permission denied or unavailable.");
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
      // Mirror the canvas for drawing so it matches the video CSS mirror
      ctx.scale(-1, 1);
      ctx.translate(-canvasRef.current.width, 0);
      
      let leftHandFound = false;
      let rightHandFound = false;

      // Reset values defaults
      let newRotSpeed = 0;
      let newZoomSpeed = 0;
      let newDirection = MoveDirection.CENTER;
      let newGesture = GestureType.NONE;
      let isDragging = false;

      if (result.landmarks && result.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        
        // Loop through all detected hands
        for (let i = 0; i < result.landmarks.length; i++) {
          const landmarks = result.landmarks[i];
          const handedness = result.handedness[i][0].categoryName; // "Left" or "Right"

          // Draw skeleton
          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: handedness === "Left" ? "#3b82f6" : "#f97316", // Blue for Left, Orange for Right
            lineWidth: 2
          });
          drawingUtils.drawLandmarks(landmarks, { 
            color: handedness === "Left" ? "#60a5fa" : "#fb923c", 
            lineWidth: 1, 
            radius: 3 
          });

          // --- LEFT HAND LOGIC (Zoom & Rotation) ---
          if (handedness === "Left") {
            leftHandFound = true;
            
            // 1. Rotation (X Position)
            const wristX = landmarks[0].x;
            // MediaPipe X is 0 (Left) to 1 (Right). 
            // Since user sees mirrored video, Moving their hand Left (Real World) -> Appears Left on screen (X < 0.5)
            if (wristX < ROTATION_THRESHOLD_LEFT) {
                newDirection = MoveDirection.LEFT;
                newRotSpeed = -0.02; 
            } else if (wristX > ROTATION_THRESHOLD_RIGHT) {
                newDirection = MoveDirection.RIGHT;
                newRotSpeed = 0.02;
            }

            // 2. Zoom (Open vs Fist)
            if (isFist(landmarks)) {
                newGesture = GestureType.CLOSED_FIST;
                // Reduced sensitivity from -0.05 to -0.01
                newZoomSpeed = -0.01;
            } else if (isOpenPalm(landmarks)) {
                newGesture = GestureType.OPEN_PALM;
                // Reduced sensitivity from 0.05 to 0.01
                newZoomSpeed = 0.01;
            }
          }

          // --- RIGHT HAND LOGIC (Dragging) ---
          if (handedness === "Right") {
            rightHandFound = true;

            // Check Pinch (Thumb Tip 4 vs Index Tip 8)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const distance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) + 
                Math.pow(thumbTip.y - indexTip.y, 2)
            );

            if (distance < PINCH_THRESHOLD) {
                isDragging = true;
                // Calculate Drag Target Position
                // Map MediaPipe (0-1) to roughly Three.js view (-4 to 4 X, -3 to 3 Y)
                // Invert X because of mirroring logic
                // Invert Y because MediaPipe Y goes down, 3D Y goes up
                
                // Use the midpoint of the pinch as the cursor
                const pinchX = (thumbTip.x + indexTip.x) / 2;
                const pinchY = (thumbTip.y + indexTip.y) / 2;

                const viewScaleX = 6; // Multiplier to cover screen width
                const viewScaleY = 4; // Multiplier to cover screen height
                
                // (pinchX - 0.5) centers it. Multiply by scale.
                // Note: landmarks.x is 0 on the left.
                // If I move right hand to right side of screen, x is close to 0 (because mirrored).
                // So if x is 0 (visual right), we want positive world X.
                // If x is 1 (visual left), we want negative world X.
                const targetX = (0.5 - pinchX) * viewScaleX; 
                const targetY = (0.5 - pinchY) * viewScaleY; // 0 is top -> positive Y, 1 is bottom -> negative Y

                controlRef.current.panPosition = { x: targetX, y: targetY };
            }
          }
        }
      }

      // Update Shared Refs
      // We only reset rotation/zoom if Left hand is missing, but if Right hand is moving, we don't stop rotation immediately
      // to allow combined movements, though typically we just update every frame.
      
      controlRef.current.rotationSpeed = newRotSpeed;
      controlRef.current.zoomSpeed = newZoomSpeed;
      controlRef.current.isDragging = isDragging;

      // Update UI State
      onStateChange(newGesture, newDirection, isDragging);
      
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  // Helper: Detect Fist
  const isFist = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const tips = [8, 12, 16, 20];
      let totalDist = 0;
      tips.forEach(idx => {
          totalDist += Math.sqrt(
              Math.pow(landmarks[idx].x - wrist.x, 2) + 
              Math.pow(landmarks[idx].y - wrist.y, 2)
          );
      });
      const avgDist = totalDist / 4;
      // Normalization factor (Wrist to Index MCP)
      const handSize = Math.sqrt(
          Math.pow(landmarks[5].x - wrist.x, 2) + 
          Math.pow(landmarks[5].y - wrist.y, 2)
      );
      return (avgDist / handSize) < 0.9;
  };

  // Helper: Detect Open Palm
  const isOpenPalm = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const tips = [8, 12, 16, 20];
      let totalDist = 0;
      tips.forEach(idx => {
          totalDist += Math.sqrt(
              Math.pow(landmarks[idx].x - wrist.x, 2) + 
              Math.pow(landmarks[idx].y - wrist.y, 2)
          );
      });
      const avgDist = totalDist / 4;
      const handSize = Math.sqrt(
          Math.pow(landmarks[5].x - wrist.x, 2) + 
          Math.pow(landmarks[5].y - wrist.y, 2)
      );
      return (avgDist / handSize) > 1.4;
  };

  if (error) {
    return (
      <div className="absolute bottom-4 right-4 bg-red-50 p-4 rounded-xl border border-red-100 text-red-600 text-sm max-w-[200px]">
        {error}
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-20 overflow-hidden rounded-2xl shadow-lg border-2 border-white bg-black">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-gray-900 text-white text-xs">
          Loading AI...
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-56 h-42 object-cover transform -scale-x-100" 
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