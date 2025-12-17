export enum GestureType {
  NONE = 'NONE',
  OPEN_PALM = 'OPEN_PALM', // Zoom In
  CLOSED_FIST = 'CLOSED_FIST', // Zoom Out
  PINCH = 'PINCH', // Dragging
}

export enum MoveDirection {
  CENTER = 'CENTER',
  LEFT = 'LEFT', // Rotate Left
  RIGHT = 'RIGHT', // Rotate Right
}

export interface ControlState {
  gesture: GestureType;
  direction: MoveDirection;
  isConnected: boolean;
}

// Shared ref object to communicate between React components without re-renders
export interface ControlRefs {
  rotationSpeed: number; // -1 to 1
  zoomSpeed: number; // -1 to 1
  panPosition: { x: number; y: number }; // Target position for dragging
  isDragging: boolean; // Is right hand pinching?
}