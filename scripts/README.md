# Scripts Directory Structure

This directory contains various scripts and tools for the grain processing project.

## 📁 Directory Organization

### `profiling/`
**Permanent performance analysis tools** for identifying hotspots and optimizing the grain algorithm.

- `flamegraph_profiler.ts` - Advanced CPU profiling with Inspector API
- `simple_profiler.mjs` - V8 --prof based profiling  
- `profile_hotspots.sh` - Comprehensive profiling script
- `README.md` - Detailed profiling documentation
- `output/` - Generated profile files (.cpuprofile, .txt, .log)

**Usage:**
```bash
npm run profile:hotspots      # Run all profiling tools
npm run profile:flamegraph    # Inspector-based profiling  
npm run profile:simple        # V8 --prof profiling
```

### `dev/`
**Development utilities and helpers** for ongoing development workflow.

- General development tools and utilities
- Debugging helpers and analysis scripts
- Code generators and development aids

### `temp/`
**Temporary development files** - automatically git-ignored.

- Temporary analysis scripts and one-off debugging tools
- Experimental code and quick tests
- Files that will be deleted after use

**Note:** Files in `temp/` are git-ignored and should not contain permanent tools.

## 🔧 Adding New Scripts

### For permanent tools:
- Place in appropriate subdirectory (`profiling/`, `dev/`)
- Add documentation and usage instructions
- Consider adding npm scripts to `package.json`
- Include in version control

### For temporary analysis:
- Place in `temp/` directory
- Prefix with descriptive names (`temp_`, `debug_`, `analysis_`)
- These are git-ignored and will be cleaned up periodically

## 📊 Performance Profiling

The `profiling/` directory contains comprehensive tools for performance analysis. See `profiling/README.md` for detailed usage instructions and optimization recommendations.

Key performance insights:
- **Pixel Processing: ~80-85% of total time** (main optimization target)
- **Iterative Development: Expensive** (runs pixel processing 5x)
- **Grain Generation: ~10-20% of total time** (relatively efficient)
