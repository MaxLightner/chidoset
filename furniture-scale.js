// Uniform model-size adjustment for the Chido catalogue.
// Imported dark three-seat sofa: 1.8934m -> 2.30m, per request.
// A/B calibration, room dimensions and metre-based floor textures are unchanged.
export const FURNITURE_SIZE_FACTOR=2.3/1.8934;
export const scaledFurnitureSize=size=>size.map(n=>n*FURNITURE_SIZE_FACTOR);
export const sourceFurnitureSize=(size,storedScale=1)=>size.map(n=>n/storedScale);

// Cloud products use the metres authored in Blender; demos keep legacy scaling.
export const sizeForAsset=(size,{cloud=false}={})=>cloud?[...size]:scaledFurnitureSize(size);
export const sourceSizeForAsset=(size,{cloud=false,legacyCloud=false,storedScale=FURNITURE_SIZE_FACTOR}={})=>
 cloud&&!legacyCloud?[...size]:sourceFurnitureSize(size,storedScale);
