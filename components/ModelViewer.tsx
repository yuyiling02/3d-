import React, { useRef, Suspense, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, OrbitControls } from '@react-three/drei';
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

  // Auto-scale logic: Normalize model size
  useLayoutEffect(() => {
    scene.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0 && maxDim !== Infinity) {
        const scaleFactor = 3 / maxDim;
        scene.scale.setScalar(scaleFactor);
    }
    
    scene.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }, [scene, url]);

  useFrame(() => {
    // 1. Rotation and Zoom (Left Hand) - applied to the inner group
    if (groupRef.current) {
      const { rotationSpeed, zoomSpeed } = controlRef.current;

      if (rotationSpeed !== 0) {
        groupRef.current.rotation.y += rotationSpeed;
      }

      if (zoomSpeed !== 0) {
        const currentScale = groupRef.current.scale.x;
        const newScale = Math.max(0.5, Math.min(3.0, currentScale + zoomSpeed));
        groupRef.current.scale.set(newScale, newScale, newScale);
      }
    }

    // 2. Position Dragging (Right Hand) - applied to the outer wrapper group
    if (dragGroupRef.current && controlRef.current.isDragging && controlRef.current.panPosition) {
       // Smoothly interpolate current position to target position
       const target = controlRef.current.panPosition;
       
       // Lerp factor (0.1 = smooth, 1.0 = instant)
       dragGroupRef.current.position.x += (target.x - dragGroupRef.current.position.x) * 0.1;
       // We add an offset of -1 to Y because our base "center" is shifted down
       // But wait, the previous code had position={[0, -1, 0]} on the group. 
       // We should apply the drag offset relative to that or override it.
       // Let's treat panPosition.y as an offset from the center.
       
       // target.y is calculated where 0 is center screen. 
       // We want the base position to be -1, so we add target.y to -1.
       const targetY = -1 + target.y;
       dragGroupRef.current.position.y += (targetY - dragGroupRef.current.position.y) * 0.1;
    } else if (dragGroupRef.current && !controlRef.current.isDragging) {
        // Optional: Return to center when not dragging? 
        // Or just stay where left off? The prompt says "drag", implying it stays.
        // But to prevent it getting lost, let's slowly drift back to center [-1 Y] if user isn't holding it?
        // No, standard drag interaction usually leaves object where it is.
        // But if the hand disappears, maybe we want it to reset?
        // Let's keep it simple: It stays where it was left.
    }
  });

  return (
    // Outer group handles Position (Right Hand)
    // Initial position is [0, -1, 0] to center the body, but this is modified by logic
    <group ref={dragGroupRef} position={[0, -1, 0]}>
      {/* Inner group handles Rotation and Scale (Left Hand) */}
      <group ref={groupRef}>
        <Center>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  );
};

const LoadingSpinner = () => (
  <mesh visible position={[0, 0, 0]} rotation={[0, 0, 0]}>
    <sphereGeometry args={[1, 16, 16]} />
    <meshStandardMaterial color="#cbd5e1" wireframe transparent opacity={0.3} />
  </mesh>
);

const ModelViewer: React.FC<ModelViewerProps> = ({ modelUrl, controlRef }) => {
  return (
    <div className="w-full h-full bg-gradient-to-b from-gray-50 to-gray-200">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 5], fov: 45 }}>
        <Suspense fallback={<LoadingSpinner />}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <Environment preset="city" />

          <Model url={modelUrl} controlRef={controlRef} />
          
          <OrbitControls 
            makeDefault 
            enablePan={false} 
            minPolarAngle={Math.PI / 2.5} 
            maxPolarAngle={Math.PI / 1.8}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelViewer;