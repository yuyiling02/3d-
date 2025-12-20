import React, { useRef, Suspense, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { ControlRefs } from '../types';

// Fix for TypeScript errors regarding R3F intrinsic elements and missing HTML elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
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
    // 1. Rotation and Zoom (Left Hand)
    if (groupRef.current) {
      const { rotationSpeed, zoomSpeed } = controlRef.current;
      
      // Smooth rotation
      if (rotationSpeed !== 0) {
        groupRef.current.rotation.y += rotationSpeed;
      }

      // Smooth zoom
      if (zoomSpeed !== 0) {
        const currentScale = groupRef.current.scale.x;
        const newScale = THREE.MathUtils.lerp(currentScale, currentScale + zoomSpeed, 0.2);
        const clampedScale = Math.max(0.4, Math.min(4.0, newScale));
        groupRef.current.scale.set(clampedScale, clampedScale, clampedScale);
      }
      
      // Gentle idle animation if no input
      if (rotationSpeed === 0 && !controlRef.current.isDragging) {
        groupRef.current.rotation.y += Math.sin(state.clock.elapsedTime * 0.5) * 0.001;
      }
    }

    // 2. Position Dragging (Right Hand)
    if (dragGroupRef.current) {
       const { isDragging, panPosition } = controlRef.current;
       
       // Base vertical offset: -1.2 to keep it grounded and upper body centered
       const basePosition = new THREE.Vector3(0, -1.2, 0);
       
       if (isDragging && panPosition) {
          const targetX = panPosition.x;
          const targetY = -1.2 + panPosition.y;
          
          dragGroupRef.current.position.x += (targetX - dragGroupRef.current.position.x) * 0.15;
          dragGroupRef.current.position.y += (targetY - dragGroupRef.current.position.y) * 0.15;
       } else {
          // Slowly return toward horizontal center but keep vertical offset
          dragGroupRef.current.position.x *= 0.95;
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
            minPolarAngle={Math.PI / 2.5} 
            maxPolarAngle={Math.PI / 1.7}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelViewer;