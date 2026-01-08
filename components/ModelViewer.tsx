
import React, { useRef, Suspense, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { ControlRefs } from '../types';

// Fix for TypeScript errors regarding R3F intrinsic elements and missing HTML elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      primitive: any;
      ambientLight: any;
      spotLight: any;
      pointLight: any;
      [elemName: string]: any;
    }
  }
}

interface ModelViewerProps {
  modelUrl: string;
  controlRef: React.MutableRefObject<ControlRefs>;
}

const Model: React.FC<{ url: string; controlRef: React.MutableRefObject<ControlRefs> }> = ({ url, controlRef }) => {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const dragGroupRef = useRef<THREE.Group>(null);
  
  // Smooth rotation velocity ref to interpolate noisy webcam data
  const smoothedRotVel = useRef({ x: 0, y: 0 });

  // Auto-scale and Setup
  useLayoutEffect(() => {
    scene.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0 && maxDim !== Infinity) {
        // Target size: 3.5 units for better visibility
        const scaleFactor = 3.5 / maxDim;
        scene.scale.setScalar(scaleFactor);
    }
    
    scene.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Improve material look
        if (obj.material) {
          obj.material.envMapIntensity = 1.2;
        }
      }
    });
  }, [scene, url]);

  useFrame((state) => {
    if (groupRef.current) {
      const { rotationVelocity, zoomSpeed } = controlRef.current;
      
      // Interpolate Rotation Velocity for buttery smooth movement
      smoothedRotVel.current.x = THREE.MathUtils.lerp(smoothedRotVel.current.x, rotationVelocity.x, 0.2);
      smoothedRotVel.current.y = THREE.MathUtils.lerp(smoothedRotVel.current.y, rotationVelocity.y, 0.2);

      // Apply rotation
      if (Math.abs(smoothedRotVel.current.x) > 0.0001 || Math.abs(smoothedRotVel.current.y) > 0.0001) {
        groupRef.current.rotation.y += smoothedRotVel.current.y; // Yaw
        groupRef.current.rotation.x += smoothedRotVel.current.x; // Pitch
      }

      // Zoom
      if (zoomSpeed !== 0) {
        const currentScale = groupRef.current.scale.x;
        const newScale = THREE.MathUtils.lerp(currentScale, currentScale + zoomSpeed, 0.1);
        const clampedScale = Math.max(0.4, Math.min(6.0, newScale));
        groupRef.current.scale.set(clampedScale, clampedScale, clampedScale);
      }
      
      // Gentle idle animation only if completely idle
      if (rotationVelocity.x === 0 && rotationVelocity.y === 0 && !controlRef.current.isDragging) {
         groupRef.current.rotation.y += Math.sin(state.clock.elapsedTime * 0.3) * 0.001;
      }
    }

    // Position Dragging
    if (dragGroupRef.current) {
       const { isDragging, panPosition } = controlRef.current;
       
       if (isDragging && panPosition) {
          const targetX = panPosition.x;
          const targetY = -1.2 + panPosition.y; 
          
          // INCREASED LERP FACTOR: 0.75
          // Previously 0.4. This makes the visual model "snap" to the hand position much faster.
          // Since HandController now handles jitter via adaptive smoothing, we can afford a tighter visual coupling.
          dragGroupRef.current.position.x += (targetX - dragGroupRef.current.position.x) * 0.75;
          dragGroupRef.current.position.y += (targetY - dragGroupRef.current.position.y) * 0.75;
       } else {
          // Soft return to center when released
          dragGroupRef.current.position.x += (0 - dragGroupRef.current.position.x) * 0.05;
          dragGroupRef.current.position.y += (-1.2 - dragGroupRef.current.position.y) * 0.05;
       }
    }
  });

  return (
    <group ref={dragGroupRef} position={[0, -1.2, 0]}>
      <group ref={groupRef}>
        <Center top>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  );
};

const ModelViewer: React.FC<ModelViewerProps> = ({ modelUrl, controlRef }) => {
  return (
    <div className="w-full h-full bg-[#fcfcfd]">
      <Canvas 
        shadows 
        dpr={[1, 2]} 
        camera={{ position: [0, 0, 6], fov: 40 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
          <Environment preset="studio" blur={0.8} />

          <Model url={modelUrl} controlRef={controlRef} />
          
          <ContactShadows 
            position={[0, -1.2, 0]} 
            opacity={0.4} 
            scale={10} 
            blur={2.5} 
            far={1.5} 
          />
          
          <OrbitControls 
            makeDefault 
            enablePan={false}
            enableZoom={true}
            minPolarAngle={0} 
            maxPolarAngle={Math.PI}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelViewer;
