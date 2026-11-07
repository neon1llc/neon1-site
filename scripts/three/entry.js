// scripts/three/entry.js - The parts of three.js the white rabbit scene uses, bundled by build.sh.
//
// esbuild keeps only these exports and what they depend on.

// Core: renderer, scene graph, geometry, materials, lights, and math
export { WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, CanvasTexture, Mesh, Group, BoxGeometry,
  PlaneGeometry, CylinderGeometry, ShaderMaterial, MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial,
  DirectionalLight, HemisphereLight, PointLight, CatmullRomCurve3, Vector3, Vector2, Color,
  MathUtils, SRGBColorSpace, LinearFilter, AdditiveBlending, HalfFloatType, Vector4, Points, BufferGeometry,
  Float32BufferAttribute, DoubleSide, Shape, ExtrudeGeometry, LatheGeometry, RepeatWrapping } from "three";

// Add-ons: postprocessing, the rounded cabinet, and merging the furniture into a few draws
export { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
export { RenderPass } from "three/addons/postprocessing/RenderPass.js";
export { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
export { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
export { OutputPass } from "three/addons/postprocessing/OutputPass.js";
export { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
