import { GrainGenerator, SeededRandomNumberGenerator } from './src/grain-generator.js';

// Test that seeded random gives deterministic results
const settings = {
  iso: 400,
  filmType: 'kodak',
  grainIntensity: 1.0,
  upscaleFactor: 1.0
};

const seededRng = new SeededRandomNumberGenerator(12345);
const generator1 = new GrainGenerator(100, 100, settings, seededRng);

seededRng.reset();
const generator2 = new GrainGenerator(100, 100, settings, seededRng);

// Test that Poisson sampling is deterministic
const points1 = generator1.generatePoissonDiskSampling(5, 50);
seededRng.reset();
const points2 = generator2.generatePoissonDiskSampling(5, 50);

console.log('First run points:', points1.length);
console.log('Second run points:', points2.length);

// Check if they're the same
const sameLength = points1.length === points2.length;
let samePositions = true;

if (sameLength) {
  for (let i = 0; i < points1.length; i++) {
    if (Math.abs(points1[i].x - points2[i].x) > 0.001 || Math.abs(points1[i].y - points2[i].y) > 0.001) {
      samePositions = false;
      break;
    }
  }
}

console.log('Same length:', sameLength);
console.log('Same positions:', samePositions);
console.log('Deterministic:', sameLength && samePositions);
