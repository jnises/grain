#!/usr/bin/env npx tsx
/**
 * Flamegraph profiler for grain processing hotspots
 * 
 * Uses Node.js built-in CPU profiler to generate detailed performance profiles
 * that can identify specific function-level hotspots in the grain algorithm.
 * 
 * Usage:
 *   npx tsx scripts/profiling/flamegraph_profiler.ts
 * 
 * This will generate CPU profile files that can be:
 * 1. Opened in Chrome DevTools (chrome://inspect -> Open dedicated DevTools for Node -> Profiler tab)
 * 2. Analyzed with clinic.js flamegraph tools
 * 3. Processed with speedscope.app for flamegraph visualization
 */

// Set production mode to ensure devAssert calls are eliminated
process.env.NODE_ENV = 'production';

import { GrainProcessor } from '../../src/grain-processor';
import { createMockImageData } from '../../test/test-utils';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Test configurations
const TEST_CONFIGS = [
  {
    name: 'small_low_iso',
    width: 200,
    height: 150,
    settings: { iso: 200, filmType: 'kodak' as const }
  },
  {
    name: 'medium_high_iso',
    width: 400,
    height: 300,
    settings: { iso: 800, filmType: 'kodak' as const }
  },
  {
    name: 'large_extreme_iso',
    width: 600,
    height: 450,
    settings: { iso: 1600, filmType: 'kodak' as const }
  }
] as const;

/**
 * Generate CPU profile for a specific test configuration
 */
async function profileConfiguration(config: typeof TEST_CONFIGS[number]): Promise<string> {
  console.log(`🔍 Profiling ${config.name} (${config.width}x${config.height}, ISO ${config.settings.iso})...`);
  
  const outputPath = join(process.cwd(), 'scripts', 'profiling', 'output', `profile-${config.name}-${Date.now()}.cpuprofile`);
  
  // Create test image and processor
  const testImage = createMockImageData(config.width, config.height, 128);
  const processor = new GrainProcessor(config.width, config.height, config.settings);
  
  // Start CPU profiling
  const { Session } = await import('inspector');
  const session = new Session();
  session.connect();
  
  await new Promise<void>((resolve) => {
    session.post('Profiler.enable', () => {
      session.post('Profiler.start', () => {
        resolve();
      });
    });
  });
  
  const startTime = performance.now();
  
  // Run the grain processing (this is what we want to profile)
  await processor.processImage(testImage);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Stop profiling and get the profile
  const profile = await new Promise<object>((resolve) => {
    session.post('Profiler.stop', (err: Error | null, result: { profile: object }) => {
      if (err) throw err;
      resolve(result.profile);
    });
  });
  
  session.disconnect();
  
  // Write profile to file
  writeFileSync(outputPath, JSON.stringify(profile, null, 2));
  
  console.log(`✅ Profile saved: ${outputPath}`);
  console.log(`   Processing time: ${duration.toFixed(2)}ms`);
  
  return outputPath;
}

/**
 * Analyze a CPU profile to extract hotspot information
 */
function analyzeProfile(profilePath: string): void {
  console.log(`📊 Analyzing profile: ${profilePath}`);
  
  try {
    const profileData = JSON.parse(readFileSync(profilePath, 'utf8'));
    const nodes = profileData.nodes || [];
    const samples = profileData.samples || [];
    const timeDeltas = profileData.timeDeltas || [];
    
    // Create a map from node ID to node data
    const nodeMap = new Map();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }
    
    // Calculate timing information from samples and timeDeltas
    const functionStats = new Map<string, { selfTime: number, totalTime: number, hitCount: number }>();
    
    // Process samples to calculate self time for each node
    const nodeSelfTimes = new Map<number, number>();
    
    for (let i = 0; i < samples.length; i++) {
      const nodeId = samples[i];
      const timeDelta = timeDeltas[i] || 0; // Time spent in this sample (microseconds)
      
      if (nodeSelfTimes.has(nodeId)) {
        nodeSelfTimes.set(nodeId, nodeSelfTimes.get(nodeId)! + timeDelta);
      } else {
        nodeSelfTimes.set(nodeId, timeDelta);
      }
    }
    
    // Aggregate timing information by function name
    for (const node of nodes) {
      const functionName = node.callFrame?.functionName || '<anonymous>';
      const scriptName = node.callFrame?.url ? node.callFrame.url.split('/').pop() : '<unknown>';
      const key = `${functionName} (${scriptName})`;
      
      const selfTime = nodeSelfTimes.get(node.id) || 0;
      const totalTime = selfTime; // For now, use selfTime as totalTime
      const hitCount = node.hitCount || 0;
      
      if (functionStats.has(key)) {
        const existing = functionStats.get(key)!;
        existing.selfTime += selfTime;
        existing.totalTime += totalTime;
        existing.hitCount += hitCount;
      } else {
        functionStats.set(key, { selfTime, totalTime, hitCount });
      }
    }
    
    // Sort by self time (actual CPU time spent in the function)
    const sortedFunctions = Array.from(functionStats.entries())
      .filter(([, stats]) => stats.selfTime > 0)
      .sort(([, a], [, b]) => b.selfTime - a.selfTime)
      .slice(0, 20); // Top 20 hotspots
    
    console.log('\n🔥 Top CPU Hotspots (by self time):');
    console.log('┌────┬──────────────┬──────────────┬───────────┬─────────────────────────────────────────────────');
    console.log('│ #  │ Self Time    │ Total Time   │ Hit Count │ Function');
    console.log('├────┼──────────────┼──────────────┼───────────┼─────────────────────────────────────────────────');
    
    for (let i = 0; i < sortedFunctions.length; i++) {
      const [functionName, stats] = sortedFunctions[i];
      const rank = `${i + 1}.`.padStart(3);
      const selfTimeStr = `${stats.selfTime.toFixed(2)}μs`.padStart(12);
      const totalTimeStr = `${stats.totalTime.toFixed(2)}μs`.padStart(12);
      const hitCountStr = stats.hitCount.toString().padStart(9);
      const funcNameShort = functionName.length > 45 ? functionName.substring(0, 42) + '...' : functionName;
      
      console.log(`│ ${rank} │ ${selfTimeStr} │ ${totalTimeStr} │ ${hitCountStr} │ ${funcNameShort}`);
    }
    
    console.log('└────┴──────────────┴──────────────┴───────────┴─────────────────────────────────────────────────');
    
    // Calculate total self time for percentage analysis
    const totalSelfTime = Array.from(functionStats.values()).reduce((sum, stats) => sum + stats.selfTime, 0);
    
    console.log('\n📈 Performance Analysis:');
    console.log(`Total measured CPU time: ${totalSelfTime.toFixed(2)}μs`);
    
    if (sortedFunctions.length > 0) {
      const topFunction = sortedFunctions[0];
      const topPercentage = (topFunction[1].selfTime / totalSelfTime * 100);
      console.log(`Biggest hotspot: ${topFunction[0]}`);
      console.log(`  └─ ${topFunction[1].selfTime.toFixed(2)}μs (${topPercentage.toFixed(1)}% of total CPU time)`);
      
      // Look for grain processing specific functions
      const grainFunctions = sortedFunctions.filter(([name]) => 
        name.includes('grain') || name.includes('process') || name.includes('pixel') || name.includes('density')
      );
      
      if (grainFunctions.length > 0) {
        console.log('\n🎯 Grain Processing Hotspots:');
        for (const [functionName, stats] of grainFunctions.slice(0, 5)) {
          const percentage = (stats.selfTime / totalSelfTime * 100);
          console.log(`  • ${functionName}: ${stats.selfTime.toFixed(2)}μs (${percentage.toFixed(1)}%)`);
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Error analyzing profile: ${error}`);
  }
}

/**
 * Generate performance summary and recommendations
 */
function generateRecommendations(profilePaths: string[]): void {
  console.log('\n💡 Optimization Recommendations:');
  console.log('1. Focus optimization efforts on the functions with highest self time');
  console.log('2. Functions with high hit count but low self time may benefit from inlining');
  console.log('3. Look for opportunities to reduce computational complexity in top hotspots');
  console.log('4. Consider caching or memoization for frequently called functions');
  
  console.log('\n🛠️  Next Steps:');
  console.log('1. Open profile files in Chrome DevTools:');
  console.log('   • Navigate to chrome://inspect');
  console.log('   • Click "Open dedicated DevTools for Node"');
  console.log('   • Go to Profiler tab and load the .cpuprofile files');
  
  for (const path of profilePaths) {
    console.log(`   • ${path}`);
  }
  
  console.log('\n2. Alternative analysis tools:');
  console.log('   • speedscope.app - Upload .cpuprofile files for flamegraph visualization');
  console.log('   • clinic.js - Install with: npm install -g clinic');
  console.log('   • --prof flag - Use Node.js built-in profiler for V8-level analysis');
  
  console.log('\n3. Consider installing clinic.js for more advanced profiling:');
  console.log('   npm install -g clinic');
  console.log('   clinic flame -- node your-script.js');
}

/**
 * Main profiling execution
 */
async function main(): Promise<void> {
  console.log('🚀 Starting flamegraph profiling for grain processing hotspots...\n');
  
  const profilePaths: string[] = [];
  
  try {
    // Profile each configuration
    for (const config of TEST_CONFIGS) {
      const profilePath = await profileConfiguration(config);
      profilePaths.push(profilePath);
      
      // Analyze immediately to show hotspots
      analyzeProfile(profilePath);
      console.log('\n' + '─'.repeat(80) + '\n');
    }
    
    // Generate final recommendations
    generateRecommendations(profilePaths);
    
    console.log('\n✅ Flamegraph profiling complete!');
    console.log(`Generated ${profilePaths.length} CPU profile files.`);
    
  } catch (error) {
    console.error('❌ Error during profiling:', error);
    throw error;
  }
}

// Run the profiler
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
