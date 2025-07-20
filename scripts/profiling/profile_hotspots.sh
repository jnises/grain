#!/usr/bin/env bash
# 
# Comprehensive performance profiling script for grain processing
# This script runs multiple profiling approaches to identify hotspots
#

set -e  # Exit on any error

echo "🚀 Starting comprehensive grain processing profiling..."
echo ""

# Create output directory for profiles
PROFILE_DIR="scripts/profiling/output"
mkdir -p "$PROFILE_DIR"

echo "📁 Profile outputs will be saved in: $PROFILE_DIR"
echo ""

# 1. Run the TypeScript flamegraph profiler
echo "1. 🔥 Running TypeScript Inspector-based profiler..."
npx tsx scripts/profiling/flamegraph_profiler.ts

echo ""
echo "2. 🔥 Running Node.js --prof profiler..."

# 2. Run the Node.js --prof profiler
npx tsx scripts/profiling/simple_profiler.ts

# Find and process the profile log
PROFILE_LOG=$(ls -t isolate-*.log 2>/dev/null | head -1 || echo "")

if [ -n "$PROFILE_LOG" ]; then
    echo "📊 Processing V8 profile log: $PROFILE_LOG"
    
    # Process the profile and save to our profiles directory
    OUTPUT_FILE="$PROFILE_DIR/v8-profile-$(date +%Y%m%d-%H%M%S).txt"
    node --prof-process "$PROFILE_LOG" > "$OUTPUT_FILE"
    
    echo "✅ V8 profile processed and saved to: $OUTPUT_FILE"
    
    # Clean up the original log file
    rm "$PROFILE_LOG"
    
    # Show a preview of the hotspots
    echo ""
    echo "🔥 Top CPU hotspots (preview):"
    echo "─────────────────────────────────────────"
    
    # Extract the "Bottom up (heavy) profile" section and show top functions
    if grep -A 50 "Bottom up (heavy) profile" "$OUTPUT_FILE" | head -20 | grep -E "^\s*[0-9]+\.[0-9]+%" > /dev/null; then
        grep -A 50 "Bottom up (heavy) profile" "$OUTPUT_FILE" | head -20 | grep -E "^\s*[0-9]+\.[0-9]+%"
    else
        echo "Profile data available in $OUTPUT_FILE"
    fi
    
    echo "─────────────────────────────────────────"
    echo "💡 Open $OUTPUT_FILE for full profiling details"
else
    echo "⚠️  No V8 profile log found. Make sure --prof is enabled."
fi

echo ""
echo "3. 📊 Suggesting additional profiling tools..."

# 3. Suggest clinic.js if not installed
if ! command -v clinic > /dev/null; then
    echo "📦 Install clinic.js for advanced profiling:"
    echo "   npm install -g clinic"
    echo ""
    echo "   Then run:"
    echo "   clinic flame -- node -r tsx/esm scripts/profiling/simple_profiler.mjs"
    echo "   clinic doctor -- node -r tsx/esm scripts/profiling/simple_profiler.mjs"
else
    echo "✅ clinic.js is installed. You can run:"
    echo "   clinic flame -- node -r tsx/esm scripts/profiling/simple_profiler.mjs"
    echo "   clinic doctor -- node -r tsx/esm scripts/profiling/simple_profiler.mjs"
fi

echo ""
echo "4. 🌐 Web-based flame graph tools:"
echo "   • Upload .cpuprofile files to: https://speedscope.app"
echo "   • Open Chrome DevTools: chrome://inspect -> Node DevTools -> Profiler"

echo ""
echo "✅ Comprehensive profiling complete!"
echo "📁 Check $PROFILE_DIR for all generated profile files"
echo ""
echo "💡 Next steps:"
echo "   1. Analyze the profile data to identify bottlenecks"
echo "   2. Focus optimization on functions with highest self time"
echo "   3. Consider algorithmic improvements for hot paths"
