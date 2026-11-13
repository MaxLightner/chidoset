// Uniform model-size adjustment requested for the Chido scene.
// Imported dark three-seat sofa: 1.8934m -> 2.50m. Room geometry and
// metre-based A/B calibration remain unchanged. This is not an AR pose scale.
export const FURNITURE_SIZE_FACTOR=2.5/1.8934;
export const scaledFurnitureSize=size=>size.map(n=>n*FURNITURE_SIZE_FACTOR);
export const sourceFurnitureSize=(size,storedScale=1)=>size.map(n=>n/storedScale);
