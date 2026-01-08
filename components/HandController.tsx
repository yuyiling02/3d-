
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { ControlRefs, GestureType, MoveDirection } from '../types';

interface HandControllerProps {
  controlRef: React.MutableRefObject<ControlRefs>;
  onStateChange: (gesture: GestureType, direction: MoveDirection, isDragging: boolean) => void;
}

// Simple Low-Pass Filter for smoothing coordinates
const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const HandController: React.FC<HandControllerProps> = ({ controlRef, onStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // Keep latest callback to avoid stale closures in RAF loop
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  // Smoothing refs
  const smoothRightPinchRef = useRef({ x: 0.5, y: 0.5 });
  const smoothLeftFingerCenterRef = useRef({ x: 0.5, y: 0.5 });
  
  // Previous contact state for hysteresis
  const wasContactingRef = useRef(false);

  // Store previous position for Delta calculation (Rotation)
  const prevLeftPosRef = useRef<{x: number, y: number} | null>(null);

  // Constants
  const PINCH_THRESHOLD = 0.05;
  const FINGER_CONTACT_THRESHOLD = 0.05; 
  const CONTACT_THRESHOLD = 0.12; 
  
  // INCREASED SENSITIVITY: 0.15 -> 0.35
  const ZOOM_SENSITIVITY = 0.35;
  
  // Adjusted for better range of motion
  const DRAG_SCALE_X = 7.0; 
  const DRAG_SCALE_Y = 5.5; 
  const ROTATION_SENSITIVITY = 6.0; 

  const SMOOTHING_FACTOR_ROTATION = 0.4; 
  const ROTATION_DEADZONE = 0.002; 

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

  const isFingerExtended = (landmarks: any[], tipIdx: number, pipIdx: number) => {
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
  };

  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const getPinchDistance = (landmarks: any[]) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    return getDistance(thumbTip, indexTip);
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
      
      // Default States
      let rotVelX = 0; 
      let rotVelY = 0; 
      let newZoomSpeed = 0;
      let newDirection = MoveDirection.CENTER;
      let newGesture = GestureType.NONE;
      let isDragging = false;

      if (result.landmarks && result.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        
        let leftHandLandmarks: any[] | null = null;
        let rightHandLandmarks: any[] | null = null;

        // 1. Identify Hands & Visuals
        for (let i = 0; i < result.landmarks.length; i++) {
          const landmarks = result.landmarks[i];
          const handedness = result.handedness[i][0].categoryName;
          
          if (handedness === "Left") leftHandLandmarks = landmarks;
          if (handedness === "Right") rightHandLandmarks = landmarks;

          drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: handedness === "Right" ? "#86e3ce" : "#ffddca", 
            lineWidth: 3
          });
          drawingUtils.drawLandmarks(landmarks, { 
            color: "#ffffff", lineWidth: 1, radius: 2 
          });
        }

        // 2. DUAL HAND LOGIC: Contact Detection with Hysteresis
        let isContacting = false;
        if (leftHandLandmarks && rightHandLandmarks) {
           const leftWrist = leftHandLandmarks[0];
           const rightWrist = rightHandLandmarks[0];
           const dist = getDistance(leftWrist, rightWrist);
           
           // Hysteresis: Require larger distance to exit contact state than to enter it
           // This prevents flickering when hands are near the threshold
           const threshold = wasContactingRef.current ? CONTACT_THRESHOLD * 1.3 : CONTACT_THRESHOLD;
           
           if (dist < threshold) {
             newGesture = GestureType.DUAL_HAND_CONTACT;
             isContacting = true;
           }
        }
        wasContactingRef.current = isContacting;

        // 3. INDIVIDUAL HAND LOGIC (Only if not contacting)
        if (!isContacting) {
            
            // --- RIGHT HAND: Dragging (Pinch) ---
            if (rightHandLandmarks) {
                const pinchDist = getPinchDistance(rightHandLandmarks);
                
                if (pinchDist < PINCH_THRESHOLD) {
                    isDragging = true;
                    newGesture = GestureType.RIGHT_PINCH_DRAG;
                    
                    const thumbTip = rightHandLandmarks[4];
                    const indexTip = rightHandLandmarks[8];
                    // Raw pinch center
                    const rawX = (thumbTip.x + indexTip.x) / 2;
                    const rawY = (thumbTip.y + indexTip.y) / 2;
                    
                    // --- OPTIMIZED ADAPTIVE SMOOTHING ALGORITHM ---
                    const dx = rawX - smoothRightPinchRef.current.x;
                    const dy = rawY - smoothRightPinchRef.current.y;
                    const movementDelta = Math.sqrt(dx * dx + dy * dy);

                    // Refined curve: 
                    // Very small movements (< 0.005) -> Low factor (~0.1) -> High stability (Sticky)
                    // Fast movements -> High factor (~0.8) -> High responsiveness (Follow)
                    // Lowered multiplier from 25 to 15 to reduce jittery transitions
                    const adaptiveFactor = Math.min(0.85, Math.max(0.1, movementDelta * 15));

                    smoothRightPinchRef.current.x = lerp(smoothRightPinchRef.current.x, rawX, adaptiveFactor);
                    smoothRightPinchRef.current.y = lerp(smoothRightPinchRef.current.y, rawY, adaptiveFactor);

                    const targetX = (0.5 - smoothRightPinchRef.current.x) * DRAG_SCALE_X; 
                    const targetY = (0.5 - smoothRightPinchRef.current.y) * DRAG_SCALE_Y;
                    
                    controlRef.current.panPosition = { x: targetX, y: targetY };
                } else {
                   // If released, soft reset the tracking ref to the wrist or current position
                   // so it doesn't "jump" when re-pinching
                   const wrist = rightHandLandmarks[0];
                   // Keep the ref close to current hand position but don't update controlRef
                   smoothRightPinchRef.current = { x: wrist.x, y: wrist.y };
                }
            }

            // --- LEFT HAND: Rotate (Index+Middle) OR Zoom (Open/Fist) ---
            if (leftHandLandmarks) {
                const indexTip = leftHandLandmarks[8];
                const middleTip = leftHandLandmarks[12];
                const fingersDist = getDistance(indexTip, middleTip);

                const isIndexUp = isFingerExtended(leftHandLandmarks, 8, 6);
                const isMiddleUp = isFingerExtended(leftHandLandmarks, 12, 10);
                const isRingUp = isFingerExtended(leftHandLandmarks, 16, 14);
                const isPinkyUp = isFingerExtended(leftHandLandmarks, 20, 18);

                const rawFingerCenterX = (indexTip.x + middleTip.x) / 2;
                const rawFingerCenterY = (indexTip.y + middleTip.y) / 2;

                smoothLeftFingerCenterRef.current.x = lerp(smoothLeftFingerCenterRef.current.x, rawFingerCenterX, SMOOTHING_FACTOR_ROTATION);
                smoothLeftFingerCenterRef.current.y = lerp(smoothLeftFingerCenterRef.current.y, rawFingerCenterY, SMOOTHING_FACTOR_ROTATION);

                // 1. ROTATE: Index + Middle Fingers Merged (Touching)
                if (fingersDist < FINGER_CONTACT_THRESHOLD && isIndexUp && isMiddleUp) {
                    newGesture = GestureType.LEFT_TWO_FINGER_ROTATE;
                    
                    if (prevLeftPosRef.current) {
                        // Calculate Delta (Movement)
                        const deltaX = smoothLeftFingerCenterRef.current.x - prevLeftPosRef.current.x;
                        const deltaY = smoothLeftFingerCenterRef.current.y - prevLeftPosRef.current.y;

                        // Deadzone check
                        if (Math.abs(deltaX) > ROTATION_DEADZONE || Math.abs(deltaY) > ROTATION_DEADZONE) {
                             // Invert X for mirror effect
                             rotVelY = -deltaX * ROTATION_SENSITIVITY; 
                             rotVelX = deltaY * ROTATION_SENSITIVITY;
                        }
                    }
                    
                    // Update previous position
                    prevLeftPosRef.current = { ...smoothLeftFingerCenterRef.current };
                } else {
                    prevLeftPosRef.current = null;
                    
                    // 2. ZOOM IN: Open Palm (Check all fingers for reliability)
                    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && fingersDist >= FINGER_CONTACT_THRESHOLD) {
                        newGesture = GestureType.ZOOM_IN_PALM;
                        newZoomSpeed = ZOOM_SENSITIVITY;
                    }
                    // 3. ZOOM OUT: Fist (Check if fingers are folded)
                    else if (!isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                        newGesture = GestureType.ZOOM_OUT_FIST;
                        newZoomSpeed = -ZOOM_SENSITIVITY;
                    }
                }
            }
        }
      }

      controlRef.current.rotationVelocity = { x: rotVelX, y: rotVelY };
      controlRef.current.zoomSpeed = newZoomSpeed;
      controlRef.current.isDragging = isDragging;
      
      // Use ref to call the latest callback
      if (onStateChangeRef.current) {
        onStateChangeRef.current(newGesture, newDirection, isDragging);
      }
      
      ctx.restore();
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  if (error) return <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-400 text-[10px] font-black">{error}</div>;

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest">
          AI Vision Init...
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
