// Uniform model-size adjustment for the Chido catalogue.
// Imported dark three-seat sofa: 1.8934m -> 2.30m, per request.
// A/B calibration, room dimensions and metre-based floor textures are unchanged.
export const FURNITURE_SIZE_FACTOR=2.3/1.8934;
export const scaledFurnitureSize=size=>size.map(n=>n*FURNITURE_SIZE_FACTOR);
export const sourceFurnitureSize=(size,storedScale=1)=>size.map(n=>n/storedScale);
