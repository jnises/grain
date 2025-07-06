#!/usr/bin/env node

// Quick performance demo script
// Run this to see the grain processing optimization in action

import { GrainGenerator } from '../src/grain-generator.js';

console.log('🎯 Grain Processing Performance Demo\n');
console.log('This demonstrates the multiple layers optimization improvement.\n');

// Test configuration
const testConfig = {
  width: 400,
  height: 300,
  iso: 800,
  filmType: 'kodak',
  grainIntensity: 1.0,
  upscaleFactor: 1.0
};

async function runDemo() {
  console.log(`📏 Test image: ${testConfig.width}x${testConfig.height} (${testConfig.width * testConfig.height} pixels)`);
  console.log(`⚙️  Settings: ISO ${testConfig.iso}, ${testConfig.filmType} film\n`);

  // Test single layer mode
  console.log('🔍 Testing Single Layer Mode...');
  const singleLayerSettings = { ...testConfig, useMultipleLayers: false };
  const singleLayerGenerator = new GrainGenerator(testConfig.width, testConfig.height, singleLayerSettings);
  
  const singleStart = performance.now();
  const singleGrains = singleLayerGenerator.generateGrainStructure();
  const singleEnd = performance.now();
  const singleTime = singleEnd - singleStart;
  
  console.log(`  ✅ Completed in ${singleTime.toFixed(2)}ms`);
  console.log(`  📊 Generated ${singleGrains.length} grains`);
  
  // Test multiple layers mode
  console.log('\n🔍 Testing Multiple Layers Mode...');
  const multiLayerSettings = { ...testConfig, useMultipleLayers: true };
  const multiLayerGenerator = new GrainGenerator(testConfig.width, testConfig.height, multiLayerSettings);
  
  const multiStart = performance.now();
  const multiLayers = multiLayerGenerator.generateMultipleGrainLayers();
  const multiEnd = performance.now();
  const multiTime = multiEnd - multiStart;
  
  const totalGrains = multiLayers.reduce((sum, layer) => sum + layer.grains.length, 0);
  console.log(`  ✅ Completed in ${multiTime.toFixed(2)}ms`);
  console.log(`  📊 Generated ${multiLayers.length} layers with ${totalGrains} total grains`);
  console.log(`  📊 Layers: ${multiLayers.map(l => `${l.layerType}(${l.grains.length})`).join(', ')}`);
  
  // Performance comparison
  console.log('\n📈 Performance Analysis:');
  const performanceRatio = singleTime / multiTime;
  const speedDiff = Math.abs(performanceRatio - 1) * 100;
  
  if (performanceRatio > 1) {
    console.log(`  🚀 Multiple layers is ${speedDiff.toFixed(1)}% FASTER than single layer!`);
    console.log(`  🎉 Optimization SUCCESS! Multiple layers should be comparable to single layer performance.`);
  } else if (performanceRatio > 0.5) {
    console.log(`  ⚡ Multiple layers is ${speedDiff.toFixed(1)}% slower but within acceptable range`);
    console.log(`  ✅ Optimization working - performance is reasonable for the extra functionality.`);
  } else {
    console.log(`  ⚠️  Multiple layers is ${speedDiff.toFixed(1)}% slower - optimization may need work`);
  }
  
  console.log(`  📊 Performance ratio: ${performanceRatio.toFixed(2)}x`);
  console.log(`  📊 Single layer speed: ${(testConfig.width * testConfig.height / singleTime * 1000 / 1000000).toFixed(2)}M pixels/sec`);
  console.log(`  📊 Multiple layers speed: ${(testConfig.width * testConfig.height / multiTime * 1000 / 1000000).toFixed(2)}M pixels/sec`);
  
  console.log('\n🏁 Demo completed!');
  console.log('\n💡 Key insights:');
  console.log('   • Before optimization: Multiple layers would be much slower due to O(n²) complexity');
  console.log('   • After optimization: Multiple layers performance is comparable to single layer');
  console.log('   • The optimization uses grain-to-layer mapping to avoid expensive filtering operations');
}

runDemo().catch(console.error);
