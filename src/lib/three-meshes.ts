/** Three.js objects for the envelope and the design massing, with shared materials. */
import * as THREE from "three";
import { COLOURS, USE_COLOURS } from "./colours.ts";
import type { Design, Use } from "./designs.ts";
import type { Envelope } from "./envelope.ts";
import { designMassing } from "./massing.ts";

const envelopeMaterial = new THREE.MeshLambertMaterial({
  color: COLOURS.envelope,
  transparent: true,
  opacity: 0.28,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const envelopeLineMaterial = new THREE.LineBasicMaterial({ color: "#0f766e", transparent: true });
const designLineMaterial = new THREE.LineBasicMaterial({
  color: "#1e293b",
  transparent: true,
  opacity: 0.18,
});
const useMaterials = new Map<Use, THREE.MeshLambertMaterial>();

/** One shared material per use, coloured like the floor table. */
function materialFor(use: Use): THREE.MeshLambertMaterial {
  let material = useMaterials.get(use);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color: USE_COLOURS[use], side: THREE.DoubleSide });
    useMaterials.set(use, material);
  }
  return material;
}

function solidMesh(positions: number[], indices: number[], material: THREE.Material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function lineSegments(positions: number[], material: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, material);
}

/** The allowed envelope: a translucent volume with its outline. */
export function buildEnvelopeGroup(envelope: Envelope | null): THREE.Group {
  const group = new THREE.Group();
  if (envelope?.mesh.indices.length) {
    group.add(solidMesh(envelope.mesh.positions, envelope.mesh.indices, envelopeMaterial));
    group.add(lineSegments(envelope.mesh.lines, envelopeLineMaterial));
  }
  return group;
}

/** A concept design: one solid per part, coloured by use, with a line at every floor. */
export function buildDesignGroup(design: Design): THREE.Group {
  const group = new THREE.Group();
  for (const part of designMassing(design)) {
    group.add(solidMesh(part.positions, part.indices, materialFor(part.use)));
    group.add(lineSegments(part.lines, designLineMaterial));
  }
  return group;
}

/** With a design shown, the envelope becomes a faint ghost around it. */
export function setEnvelopeGhosted(ghosted: boolean) {
  envelopeMaterial.opacity = ghosted ? 0.1 : 0.28;
  envelopeLineMaterial.opacity = ghosted ? 0.35 : 1;
}

/** Free the GPU buffers of a group's meshes (materials are shared and kept). */
export function disposeGroup(group: THREE.Group) {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
    }
  });
}
