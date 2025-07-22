// Poisson Disk Sampling Directional Bias Analysis Tool
// Analyzes the Poisson disk sampling algorithm for potential directional bias that could cause stripes

import { GrainGenerator, SeededRandomNumberGenerator } from '../grain-generator';
import { FILM_CHARACTERISTICS } from '../constants';
import type { GrainSettings, Point2D } from '../types';

interface DirectionalAnalysis {
  horizontalSpacing: number[];
  verticalSpacing: number[];
  diagonal1Spacing: number[];
  diagonal2Spacing: number[];
  radialDistribution: number[];
  angularDistribution: number[];
}

interface BiasMetrics {
  horizontalVariance: number;
  verticalVariance: number;
  diagonal1Variance: number;
  diagonal2Variance: number;
  maxMinRatio: number;
  preferredDirection: string;
  anisotropyScore: number;
  radialUniformity: number;
  angularUniformity: number;
}

export class PoissonBiasAnalyzer {
  private readonly testSizes = [
    { width: 200, height: 200 },
    { width: 400, height: 300 },
    { width: 600, height: 400 },
    { width: 800, height: 600 }
  ];

  private readonly testSeeds = [12345, 67890, 11111, 22222, 33333, 44444, 55555, 66666, 77777, 88888];

  /**
   * Run comprehensive bias analysis on Poisson disk sampling
   */
  public runBiasAnalysis(): void {
    console.log('=== Poisson Disk Sampling Directional Bias Analysis ===\n');

    // Test with different ISO levels to see if bias varies
    const isoLevels = [100, 400, 800, 1600, 3200];

    for (const iso of isoLevels) {
      console.log(`\n--- Testing ISO ${iso} ---`);
      this.analyzeIsoLevel(iso);
    }

    // Test with different minimum distance values
    console.log('\n--- Testing Different Minimum Distance Values ---');
    this.analyzeMinDistanceVariations();

    // Test initial point distribution bias
    console.log('\n--- Testing Initial Point Distribution ---');
    this.analyzeInitialPointBias();

    // Test candidate generation bias
    console.log('\n--- Testing Candidate Generation ---');
    this.analyzeCandidateGenerationBias();
  }

  private analyzeIsoLevel(iso: number): void {
    const settings: GrainSettings = {
      iso,
      filmType: 'kodak',
      grainIntensity: 1.0
    };

    const allMetrics: BiasMetrics[] = [];

    // Test multiple image sizes and seeds
    for (const size of this.testSizes) {
      for (const seed of this.testSeeds.slice(0, 5)) { // Use first 5 seeds for each size
        const rng = new SeededRandomNumberGenerator(seed);
        const generator = new GrainGenerator(size.width, size.height, settings, rng);

        // Calculate parameters similar to how the real algorithm does
        const filmChar = FILM_CHARACTERISTICS[settings.filmType];
        const baseGrainSize = Math.max(0.5, iso / 200);
        const minDistance = baseGrainSize * 1.2;
        const targetDensity = Math.max(0.1, 0.6 * (400 / iso));
        const maxSamples = Math.floor(size.width * size.height * targetDensity * 0.85);

        // Generate points using Poisson disk sampling
        const points = generator.generatePoissonDiskSampling(minDistance, maxSamples);

        // Analyze directional bias
        const analysis = this.analyzeDirectionalDistribution(points, size.width, size.height);
        const metrics = this.calculateBiasMetrics(analysis);

        allMetrics.push(metrics);
      }
    }

    // Calculate aggregate statistics
    this.reportAggregateMetrics(allMetrics, iso);
  }

  private analyzeDirectionalDistribution(points: Point2D[], width: number, height: number): DirectionalAnalysis {
    const analysis: DirectionalAnalysis = {
      horizontalSpacing: [],
      verticalSpacing: [],
      diagonal1Spacing: [],
      diagonal2Spacing: [],
      radialDistribution: [],
      angularDistribution: []
    };

    // Sort points for easier analysis
    const sortedByX = [...points].sort((a, b) => a.x - b.x);
    const sortedByY = [...points].sort((a, b) => a.y - b.y);

    // Analyze horizontal spacing
    for (let i = 1; i < sortedByX.length; i++) {
      if (Math.abs(sortedByX[i].y - sortedByX[i-1].y) < height * 0.1) { // Similar Y coordinates
        analysis.horizontalSpacing.push(sortedByX[i].x - sortedByX[i-1].x);
      }
    }

    // Analyze vertical spacing
    for (let i = 1; i < sortedByY.length; i++) {
      if (Math.abs(sortedByY[i].x - sortedByY[i-1].x) < width * 0.1) { // Similar X coordinates
        analysis.verticalSpacing.push(sortedByY[i].y - sortedByY[i-1].y);
      }
    }

    // Analyze diagonal spacing and angular distribution
    const centerX = width / 2;
    const centerY = height / 2;

    for (const point of points) {
      // Radial distance from center
      const radialDistance = Math.sqrt((point.x - centerX) ** 2 + (point.y - centerY) ** 2);
      analysis.radialDistribution.push(radialDistance);

      // Angular distribution
      const angle = Math.atan2(point.y - centerY, point.x - centerX);
      const normalizedAngle = (angle + Math.PI) / (2 * Math.PI); // Normalize to 0-1
      analysis.angularDistribution.push(normalizedAngle);
    }

    // Analyze diagonal spacing by finding nearest neighbors in diagonal directions
    for (const point of points) {
      const nearbyPoints = points.filter(p =>
        p !== point &&
        Math.abs(p.x - point.x) < width * 0.2 &&
        Math.abs(p.y - point.y) < height * 0.2
      );

      for (const nearby of nearbyPoints) {
        const dx = nearby.x - point.x;
        const dy = nearby.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if it's roughly diagonal
        const angle = Math.atan2(dy, dx);
        const normalizedAngle = ((angle + Math.PI) / (Math.PI / 4)) % 8;

        // Diagonal 1 (45 degrees, 225 degrees)
        if (normalizedAngle < 1 || normalizedAngle > 7 || (normalizedAngle > 3 && normalizedAngle < 5)) {
          analysis.diagonal1Spacing.push(distance);
        }
        // Diagonal 2 (135 degrees, 315 degrees)
        if ((normalizedAngle > 1 && normalizedAngle < 3) || (normalizedAngle > 5 && normalizedAngle < 7)) {
          analysis.diagonal2Spacing.push(distance);
        }
      }
    }

    return analysis;
  }

  private calculateBiasMetrics(analysis: DirectionalAnalysis): BiasMetrics {
    const calculateVariance = (values: number[]): number => {
      if (values.length === 0) return 0;
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
      return variance;
    };

    const calculateUniformity = (values: number[]): number => {
      if (values.length === 0) return 1;

      // Sort values and check how evenly distributed they are
      const sorted = [...values].sort((a, b) => a - b);
      const differences = [];
      for (let i = 1; i < sorted.length; i++) {
        differences.push(sorted[i] - sorted[i-1]);
      }

      if (differences.length === 0) return 1;

      const meanDiff = differences.reduce((sum, val) => sum + val, 0) / differences.length;
      const variance = differences.reduce((sum, val) => sum + (val - meanDiff) ** 2, 0) / differences.length;

      // Return inverse of coefficient of variation (lower variance = higher uniformity)
      return meanDiff > 0 ? meanDiff / Math.sqrt(variance) : 1;
    };

    const horizontalVariance = calculateVariance(analysis.horizontalSpacing);
    const verticalVariance = calculateVariance(analysis.verticalSpacing);
    const diagonal1Variance = calculateVariance(analysis.diagonal1Spacing);
    const diagonal2Variance = calculateVariance(analysis.diagonal2Spacing);

    const variances = [horizontalVariance, verticalVariance, diagonal1Variance, diagonal2Variance];
    const maxVariance = Math.max(...variances);
    const minVariance = Math.min(...variances.filter(v => v > 0));
    const maxMinRatio = minVariance > 0 ? maxVariance / minVariance : 0;

    let preferredDirection = 'unknown';
    const maxVarIndex = variances.indexOf(maxVariance);
    switch (maxVarIndex) {
      case 0: preferredDirection = 'horizontal'; break;
      case 1: preferredDirection = 'vertical'; break;
      case 2: preferredDirection = 'diagonal1'; break;
      case 3: preferredDirection = 'diagonal2'; break;
    }

    const anisotropyScore = this.calculateAnisotropyScore(variances);
    const radialUniformity = calculateUniformity(analysis.radialDistribution);
    const angularUniformity = calculateUniformity(analysis.angularDistribution);

    return {
      horizontalVariance,
      verticalVariance,
      diagonal1Variance,
      diagonal2Variance,
      maxMinRatio,
      preferredDirection,
      anisotropyScore,
      radialUniformity,
      angularUniformity
    };
  }

  private calculateAnisotropyScore(variances: number[]): number {
    // Calculate how much the variances deviate from being equal
    const validVariances = variances.filter(v => v > 0);
    if (validVariances.length < 2) return 0;

    const mean = validVariances.reduce((sum, val) => sum + val, 0) / validVariances.length;
    const deviation = validVariances.reduce((sum, val) => sum + Math.abs(val - mean), 0) / validVariances.length;

    return mean > 0 ? deviation / mean : 0;
  }

  private reportAggregateMetrics(metrics: BiasMetrics[], iso: number): void {
    const avgAnisotropy = metrics.reduce((sum, m) => sum + m.anisotropyScore, 0) / metrics.length;
    const avgMaxMinRatio = metrics.reduce((sum, m) => sum + m.maxMinRatio, 0) / metrics.length;
    const avgRadialUniformity = metrics.reduce((sum, m) => sum + m.radialUniformity, 0) / metrics.length;
    const avgAngularUniformity = metrics.reduce((sum, m) => sum + m.angularUniformity, 0) / metrics.length;

    // Count preferred directions
    const directionCounts = metrics.reduce((counts, m) => {
      counts[m.preferredDirection] = (counts[m.preferredDirection] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    console.log(`  Average Anisotropy Score: ${avgAnisotropy.toFixed(4)}`);
    console.log(`  Average Max/Min Variance Ratio: ${avgMaxMinRatio.toFixed(4)}`);
    console.log(`  Average Radial Uniformity: ${avgRadialUniformity.toFixed(4)}`);
    console.log(`  Average Angular Uniformity: ${avgAngularUniformity.toFixed(4)}`);
    console.log(`  Direction Preferences:`, directionCounts);

    // Warning thresholds
    if (avgAnisotropy > 0.3) {
      console.log(`  ⚠️  WARNING: High anisotropy detected (${avgAnisotropy.toFixed(4)})`);
    }
    if (avgMaxMinRatio > 2.0) {
      console.log(`  ⚠️  WARNING: High variance ratio (${avgMaxMinRatio.toFixed(4)})`);
    }
  }

  private analyzeMinDistanceVariations(): void {
    const settings: GrainSettings = { iso: 400, filmType: 'kodak', grainIntensity: 1.0 };
    const testSize = { width: 400, height: 300 };
    const minDistances = [1.0, 2.0, 4.0, 8.0, 16.0];

    for (const minDistance of minDistances) {
      console.log(`\nTesting minDistance: ${minDistance}`);

      const allMetrics: BiasMetrics[] = [];

      for (const seed of this.testSeeds.slice(0, 3)) {
        const rng = new SeededRandomNumberGenerator(seed);
        const generator = new GrainGenerator(testSize.width, testSize.height, settings, rng);

        const maxSamples = 1000; // Fixed sample count for comparison
        const points = generator.generatePoissonDiskSampling(minDistance, maxSamples);

        const analysis = this.analyzeDirectionalDistribution(points, testSize.width, testSize.height);
        const metrics = this.calculateBiasMetrics(analysis);
        allMetrics.push(metrics);
      }

      this.reportAggregateMetrics(allMetrics, minDistance);
    }
  }

  private analyzeInitialPointBias(): void {
    console.log('\nAnalyzing initial point distribution for bias...');

    const settings: GrainSettings = { iso: 400, filmType: 'kodak', grainIntensity: 1.0 };
    const testSize = { width: 400, height: 300 };

    // Test initial point generation separately
    const initialPointSets: Point2D[][] = [];

    for (const seed of this.testSeeds) {
      const rng = new SeededRandomNumberGenerator(seed);
      const generator = new GrainGenerator(testSize.width, testSize.height, settings, rng);

      // We need to access the initial point generation logic
      // Since it's private, we'll test with very few max samples to see mostly initial points
      const points = generator.generatePoissonDiskSampling(20, 5); // Large distance, few samples
      initialPointSets.push(points);
    }

    // Analyze initial point distribution patterns
    let totalInitialPoints = 0;
    const quadrantCounts = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };

    for (const pointSet of initialPointSets) {
      totalInitialPoints += pointSet.length;

      for (const point of pointSet) {
        if (point.x < testSize.width / 2) {
          if (point.y < testSize.height / 2) {
            quadrantCounts.topLeft++;
          } else {
            quadrantCounts.bottomLeft++;
          }
        } else {
          if (point.y < testSize.height / 2) {
            quadrantCounts.topRight++;
          } else {
            quadrantCounts.bottomRight++;
          }
        }
      }
    }

    console.log(`  Total initial points generated: ${totalInitialPoints}`);
    console.log(`  Quadrant distribution:`, quadrantCounts);

    const expectedPerQuadrant = totalInitialPoints / 4;
    const quadrantDeviations = Object.values(quadrantCounts).map(count =>
      Math.abs(count - expectedPerQuadrant) / expectedPerQuadrant
    );
    const avgDeviation = quadrantDeviations.reduce((sum, dev) => sum + dev, 0) / quadrantDeviations.length;

    console.log(`  Average quadrant deviation: ${avgDeviation.toFixed(4)}`);
    if (avgDeviation > 0.2) {
      console.log(`  ⚠️  WARNING: Uneven initial point distribution`);
    }
  }

  private analyzeCandidateGenerationBias(): void {
    console.log('\nAnalyzing candidate generation for angular bias...');

    // Test the angular distribution of generated candidates
    // We'll use a simplified version of the candidate generation logic
    const rng = new SeededRandomNumberGenerator(12345);
    const angles: number[] = [];
    const radii: number[] = [];

    const numTests = 10000;
    const minDistance = 5.0;

    for (let i = 0; i < numTests; i++) {
      const angle = rng.random() * 2 * Math.PI;
      const radius = minDistance * (1 + rng.random());

      angles.push(angle);
      radii.push(radius);
    }

    // Analyze angular distribution
    const angularBins = new Array(8).fill(0); // 8 bins for 45-degree sectors
    for (const angle of angles) {
      const normalizedAngle = (angle + Math.PI) / (Math.PI / 4);
      const bin = Math.floor(normalizedAngle) % 8;
      angularBins[bin]++;
    }

    console.log(`  Angular distribution (8 bins):`, angularBins);

    const expectedPerBin = numTests / 8;
    const angularDeviations = angularBins.map(count =>
      Math.abs(count - expectedPerBin) / expectedPerBin
    );
    const avgAngularDeviation = angularDeviations.reduce((sum, dev) => sum + dev, 0) / angularDeviations.length;

    console.log(`  Average angular deviation: ${avgAngularDeviation.toFixed(4)}`);

    // Analyze radial distribution
    const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
    const expectedRadius = minDistance * 1.5; // Expected value of uniform distribution [1,2] * minDistance
    const radiusDeviation = Math.abs(avgRadius - expectedRadius) / expectedRadius;

    console.log(`  Average radius: ${avgRadius.toFixed(4)} (expected: ${expectedRadius.toFixed(4)})`);
    console.log(`  Radius deviation: ${radiusDeviation.toFixed(4)}`);

    if (avgAngularDeviation > 0.1) {
      console.log(`  ⚠️  WARNING: Angular bias in candidate generation`);
    }
    if (radiusDeviation > 0.05) {
      console.log(`  ⚠️  WARNING: Radial bias in candidate generation`);
    }
  }

  /**
   * Generate a detailed report for a specific configuration
   */
  public generateDetailedReport(
    width: number,
    height: number,
    iso: number,
    seed: number = 12345
  ): void {
    console.log(`\n=== Detailed Poisson Analysis Report ===`);
    console.log(`Image Size: ${width}x${height}`);
    console.log(`ISO: ${iso}`);
    console.log(`Seed: ${seed}\n`);

    const settings: GrainSettings = { iso, filmType: 'kodak', grainIntensity: 1.0 };
    const rng = new SeededRandomNumberGenerator(seed);
    const generator = new GrainGenerator(width, height, settings, rng);

    // Calculate realistic parameters
    const baseGrainSize = Math.max(0.5, iso / 200);
    const minDistance = baseGrainSize * 1.2;
    const targetDensity = Math.max(0.1, 0.6 * (400 / iso));
    const maxSamples = Math.floor(width * height * targetDensity * 0.85);

    console.log(`Calculated Parameters:`);
    console.log(`  Base Grain Size: ${baseGrainSize.toFixed(2)}`);
    console.log(`  Min Distance: ${minDistance.toFixed(2)}`);
    console.log(`  Target Density: ${targetDensity.toFixed(4)}`);
    console.log(`  Max Samples: ${maxSamples}\n`);

    const points = generator.generatePoissonDiskSampling(minDistance, maxSamples);
    console.log(`Generated ${points.length} points\n`);

    const analysis = this.analyzeDirectionalDistribution(points, width, height);
    const metrics = this.calculateBiasMetrics(analysis);

    console.log(`Directional Analysis:`);
    console.log(`  Horizontal spacing samples: ${analysis.horizontalSpacing.length}`);
    console.log(`  Vertical spacing samples: ${analysis.verticalSpacing.length}`);
    console.log(`  Diagonal 1 spacing samples: ${analysis.diagonal1Spacing.length}`);
    console.log(`  Diagonal 2 spacing samples: ${analysis.diagonal2Spacing.length}\n`);

    console.log(`Bias Metrics:`);
    console.log(`  Horizontal Variance: ${metrics.horizontalVariance.toFixed(4)}`);
    console.log(`  Vertical Variance: ${metrics.verticalVariance.toFixed(4)}`);
    console.log(`  Diagonal 1 Variance: ${metrics.diagonal1Variance.toFixed(4)}`);
    console.log(`  Diagonal 2 Variance: ${metrics.diagonal2Variance.toFixed(4)}`);
    console.log(`  Max/Min Ratio: ${metrics.maxMinRatio.toFixed(4)}`);
    console.log(`  Preferred Direction: ${metrics.preferredDirection}`);
    console.log(`  Anisotropy Score: ${metrics.anisotropyScore.toFixed(4)}`);
    console.log(`  Radial Uniformity: ${metrics.radialUniformity.toFixed(4)}`);
    console.log(`  Angular Uniformity: ${metrics.angularUniformity.toFixed(4)}\n`);

    // Provide recommendations
    if (metrics.anisotropyScore > 0.3) {
      console.log(`🔍 FINDING: High anisotropy detected (${metrics.anisotropyScore.toFixed(4)})`);
      console.log(`   This suggests directional bias in the Poisson sampling algorithm.`);
    }
    if (metrics.maxMinRatio > 2.0) {
      console.log(`🔍 FINDING: High variance ratio (${metrics.maxMinRatio.toFixed(4)})`);
      console.log(`   This indicates uneven spacing in different directions.`);
    }
    if (metrics.angularUniformity < 0.5) {
      console.log(`🔍 FINDING: Poor angular uniformity (${metrics.angularUniformity.toFixed(4)})`);
      console.log(`   Points may not be evenly distributed around angles.`);
    }
  }
}

// Export for use in scripts
export function runPoissonBiasAnalysis(): void {
  const analyzer = new PoissonBiasAnalyzer();
  analyzer.runBiasAnalysis();
}

export function runDetailedPoissonReport(
  width: number = 400,
  height: number = 300,
  iso: number = 400,
  seed: number = 12345
): void {
  const analyzer = new PoissonBiasAnalyzer();
  analyzer.generateDetailedReport(width, height, iso, seed);
}
