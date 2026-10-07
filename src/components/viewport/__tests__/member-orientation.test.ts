import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { memberOrientation } from '../member-orientation';
import { createWShape } from '../SectionShapes';

/**
 * The member mesh is built along object Y with the section depth along
 * object Z (#66). These tests check where those land in global coordinates,
 * which must match the local axes of the analysis.
 */

const node = (x: number, y: number, z: number) => ({ id: '', x, y, z });

function mapped(q: THREE.Quaternion, v: [number, number, number]): number[] {
  return new THREE.Vector3(...v).applyQuaternion(q).toArray();
}

function expectVec(actual: number[], expected: number[]) {
  actual.forEach((a, i) => expect(a).toBeCloseTo(expected[i], 9));
}

describe('memberOrientation', () => {
  it('draws a beam along +X with its depth vertical (global Y)', () => {
    const q = memberOrientation(node(0, 0, 0), node(240, 0, 0), 0);
    expectVec(mapped(q, [0, 1, 0]), [1, 0, 0]); // member axis
    expectVec(mapped(q, [0, 0, 1]), [0, 1, 0]); // section depth
    expectVec(mapped(q, [1, 0, 0]), [0, 0, 1]); // flange width
  });

  it('draws a vertical column with its depth in the XY plane', () => {
    // Local axes for x = +Y are y = (-1, 0, 0) and z = (0, 0, 1).
    const q = memberOrientation(node(0, 0, 0), node(0, 144, 0), 0);
    expectVec(mapped(q, [0, 1, 0]), [0, 1, 0]);
    expectVec(mapped(q, [0, 0, 1]), [-1, 0, 0]);
    expectVec(mapped(q, [1, 0, 0]), [0, 0, 1]);
  });

  it('turns a vertical column a quarter turn with beta = 90', () => {
    // beta = 90: local y = (0, 0, 1), so the depth points out of plane.
    const q = memberOrientation(node(0, 0, 0), node(0, 144, 0), 90);
    expectVec(mapped(q, [0, 0, 1]), [0, 0, 1]);
    expectVec(mapped(q, [1, 0, 0]), [1, 0, 0]);
  });

  it('is a proper rotation for a general 3D member', () => {
    const q = memberOrientation(node(1, 2, 3), node(40, 80, 80), 30);
    expect(q.length()).toBeCloseTo(1, 12);
    const x = new THREE.Vector3(...mapped(q, [0, 1, 0]));
    const dir = new THREE.Vector3(39, 78, 77).normalize();
    expectVec(x.toArray(), dir.toArray());
  });
});

describe('extruded W section placed like ElementMesh', () => {
  // Builds the mesh geometry exactly as ElementMesh does (extrude, centre,
  // rotate 90 deg about X) and applies the member orientation, then measures
  // the bounding box. A W12-like profile: d = 12, bf = 6.
  function size(I: ReturnType<typeof node>, J: ReturnType<typeof node>, beta: number) {
    const L = Math.hypot(J.x - I.x, J.y - I.y, J.z - I.z);
    const geo = new THREE.ExtrudeGeometry(createWShape(12, 6, 0.4, 0.25), {
      steps: 1, depth: L, bevelEnabled: false,
    });
    geo.translate(0, 0, -L / 2);
    geo.rotateX(Math.PI / 2);
    geo.applyQuaternion(memberOrientation(I, J, beta));
    geo.computeBoundingBox();
    return geo.boundingBox!.max.clone().sub(geo.boundingBox!.min).toArray();
  }

  it('puts a beam depth along global Y', () => {
    expectVec(size(node(0, 0, 0), node(240, 0, 0), 0), [240, 12, 6]);
  });

  it('puts a vertical column depth along global X, in the frame plane', () => {
    expectVec(size(node(0, 0, 0), node(0, 144, 0), 0), [12, 144, 6]);
  });

  it('puts a beta = 90 column depth out of plane, along global Z', () => {
    expectVec(size(node(0, 0, 0), node(0, 144, 0), 90), [6, 144, 12]);
  });
});
