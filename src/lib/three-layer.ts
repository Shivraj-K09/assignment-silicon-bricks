import * as maplibregl from "maplibre-gl";
import * as THREE from "three";

// 3d shape
/**
 * A MapLibre custom layer that renders a Three.js scene in the same WebGL
 * context and depth buffer as the map, so our meshes are hidden correctly
 * behind (and hide) the real 3D buildings.
 *
 * Add objects to `root`. Units are metres in a local frame centred on `origin`:
 *   x = east, y = north, z = up.
 */
export function createThreeLayer(id: string, origin: [number, number]) {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  let renderer: THREE.WebGLRenderer | null = null;
  let map: maplibregl.Map | null = null;

  // MapLibre's mercator y points south, so north must be flipped. The flip
  // lives on this group (not in the camera) because Three.js only corrects
  // triangle winding for mirrored *objects*; a mirrored camera matrix would
  // make every face look back-facing and get culled.
  const root = new THREE.Group();
  root.scale.set(1, -1, 1);
  scene.add(root);

  root.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-80, -120, 200);
  root.add(sun);

  // Local metres -> MapLibre mercator units (uniform scale, no mirroring).
  const m = maplibregl.MercatorCoordinate.fromLngLat(origin, 0);
  const s = m.meterInMercatorCoordinateUnits();
  const model = new THREE.Matrix4()
    .makeTranslation(m.x, m.y, m.z)
    .scale(new THREE.Vector3(s, s, s));

  const layer: maplibregl.CustomLayerInterface = {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(mapInstance, gl) {
      map = mapInstance;
      renderer = new THREE.WebGLRenderer({
        canvas: mapInstance.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    render(_gl, options) {
      if (!renderer) return;
      // mainMatrix maps MapLibre 0..1 mercator units to clip space. (modelViewProjectionMatrix
      // expects pixel world units, which do not match MercatorCoordinate.)
      const vp = new THREE.Matrix4().fromArray(
        options.defaultProjectionData.mainMatrix as unknown as number[],
      );
      camera.projectionMatrix = vp.multiply(model);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
    },
  };

  return {
    layer,
    root,
    /** Ask the map to redraw after changing the scene. */
    repaint: () => map?.triggerRepaint(),
  };
}
