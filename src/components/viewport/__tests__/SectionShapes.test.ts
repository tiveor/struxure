import { describe, it, expect } from 'vitest';
import { createWShape, createHSSRect, createPipeShape, createRectShape, createCircleShape } from '../SectionShapes';
import { sectionToShape } from '../section-to-shape';

describe('createWShape', () => {
  it('should create a closed shape with correct bounding box', () => {
    // W12x26: d=12.22, bf=6.49, tf=0.38, tw=0.23
    const shape = createWShape(12.22, 6.49, 0.38, 0.23);
    const points = shape.getPoints();

    // Should be closed (first point ≈ last point)
    const first = points[0];
    const last = points[points.length - 1];
    expect(first.x).toBeCloseTo(last.x);
    expect(first.y).toBeCloseTo(last.y);

    // Bounding box should be bf × d
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(6.49, 1);  // bf
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(12.22, 1); // d
  });

  it('should have 12 line segments for I-shape profile', () => {
    const shape = createWShape(12, 6, 0.5, 0.3);
    const points = shape.getPoints();
    // getPoints returns vertices; closePath adds return to start
    // 12 vertices + closing point = 13
    expect(points.length).toBe(13);
  });

  it('should be symmetric about both axes', () => {
    const shape = createWShape(10, 8, 0.5, 0.3);
    const points = shape.getPoints();
    // Check symmetry: for each point (x,y) there should be (-x,y)
    for (const p of points) {
      if (Math.abs(p.x) > 0.01) {
        const mirror = points.find(
          (q) => Math.abs(q.x + p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01
        );
        expect(mirror).toBeDefined();
      }
    }
  });
});

describe('W-shape area validation', () => {
  it('should approximate AISC tabulated area for W12x26', () => {
    // W12x26: A_tabulated = 7.65 in²
    // A_calculated = 2 * bf * tf + (d - 2*tf) * tw
    const d = 12.22, bf = 6.49, tf = 0.38, tw = 0.23;
    const areaCalc = 2 * bf * tf + (d - 2 * tf) * tw;
    // Geometric approximation should be within 5% of tabulated
    expect(Math.abs(areaCalc - 7.65) / 7.65).toBeLessThan(0.05);
  });
});

describe('createHSSRect', () => {
  it('should create outer shape with one hole', () => {
    const shape = createHSSRect(8, 6, 0.5);
    expect(shape.holes.length).toBe(1);
  });

  it('should have correct wall thickness', () => {
    const b = 8, h = 6, t = 0.5;
    const shape = createHSSRect(b, h, t);
    const outerPoints = shape.getPoints();
    const innerPoints = shape.holes[0].getPoints();

    const outerWidth = Math.max(...outerPoints.map((p) => p.x)) - Math.min(...outerPoints.map((p) => p.x));
    const innerWidth = Math.max(...innerPoints.map((p) => p.x)) - Math.min(...innerPoints.map((p) => p.x));
    expect(outerWidth - innerWidth).toBeCloseTo(2 * t);
  });

  it('should have correct outer dimensions', () => {
    const shape = createHSSRect(10, 8, 0.25);
    const points = shape.getPoints();
    const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    expect(width).toBeCloseTo(10);
    expect(height).toBeCloseTo(8);
  });
});

describe('createPipeShape', () => {
  it('should create circular shape with circular hole', () => {
    const shape = createPipeShape(5, 4.5);
    expect(shape.holes.length).toBe(1);
  });
});

describe('createRectShape', () => {
  it('should have correct dimensions', () => {
    const shape = createRectShape(12, 18);
    const points = shape.getPoints();
    const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    expect(width).toBeCloseTo(12);
    expect(height).toBeCloseTo(18);
  });
});

describe('createCircleShape', () => {
  it('should create a shape with no holes', () => {
    const shape = createCircleShape(3);
    expect(shape.holes.length).toBe(0);
  });
});

describe('sectionToShape', () => {
  it('should return W-shape for sections named W* with geometry data', () => {
    const result = sectionToShape({
      id: '1', name: 'W12x26', A: 7.65,
      Ix: 204, Iy: 17.3, J: 0.3,
      d: 12.22, bf: 6.49, tf: 0.38, tw: 0.23,
    });
    expect(result.type).toBe('w-shape');
  });

  it('should return rectangle for concrete material', () => {
    const result = sectionToShape(
      { id: '1', name: 'Custom', A: 144, Ix: 1728, Iy: 1728, J: 3000, b: 12, h: 12 },
      { id: 'm1', name: 'Concrete', type: 'concrete', E: 3605, G: 1502, density: 0.0001 },
    );
    expect(result.type).toBe('rectangle');
  });

  it('should fallback to circle when no geometry data', () => {
    const result = sectionToShape({
      id: '1', name: 'Unknown', A: 10, Ix: 100, Iy: 50, J: 5,
    });
    expect(result.type).toBe('circle');
  });

  it('circle radius should be derived from area', () => {
    const A = 10;
    const result = sectionToShape({
      id: '1', name: 'Unknown', A, Ix: 100, Iy: 50, J: 5,
    });
    expect(result.type).toBe('circle');
    // radius = sqrt(A / pi)
    const expectedR = Math.sqrt(A / Math.PI);
    const points = result.shape.getPoints(64);
    // Check that the max distance from center equals the expected radius
    const maxR = Math.max(...points.map((p) => Math.sqrt(p.x ** 2 + p.y ** 2)));
    expect(maxR).toBeCloseTo(expectedR, 1);
  });
});
