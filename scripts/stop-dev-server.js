#!/usr/bin/env node

/**
 * Safely stops Vite development servers using a robust detection method.
 * This cross-platform script works on Windows, macOS, and Linux.
 *
 * Detection strategy:
 * 1. First tries to find processes using Vite's default ports (5173, 5174)
 * 2. Falls back to searching for Node.js processes running Vite binaries
 * 3. Uses very specific command matching to avoid killing unrelated processes
 *
 * Usage: npm run dev:stop
 */

const VITE_PORTS = [5173, 5174];

async function stopDevServer() {
  try {
    // Dynamic import for CommonJS module
    const findProcess = (await import('find-process')).default.default;
    console.log('🔍 Checking for running Vite development servers...');

    let processes = [];
    
    // First try: Search by port (preferred method)
    for (const port of VITE_PORTS) {
      try {
        const portProcesses = await findProcess('port', port);
        if (portProcesses && portProcesses.length > 0) {
          processes.push(...portProcesses);
          console.log(`Found process(es) on port ${port}:`, portProcesses.map(p => p.pid));
        }
      } catch (error) {
        console.log(`Port ${port} search failed, will try fallback method`);
      }
    }
    
    // Fallback: If port search didn't work, search by process name but be very specific
    if (processes.length === 0) {
      console.log('Port search unsuccessful, trying process name search...');
      const nodeProcesses = await findProcess('name', 'node');
      // Be very specific: must be node running vite binary, not just containing "vite"
      const viteProcesses = nodeProcesses.filter(proc => 
        proc.cmd && (
          proc.cmd.includes('node_modules/.bin/vite') ||
          proc.cmd.includes('node_modules\\vite\\bin\\vite') ||
          proc.cmd.endsWith('/bin/vite') ||
          proc.cmd.endsWith('\\bin\\vite')
        )
      );
      processes = viteProcesses;
      if (viteProcesses.length > 0) {
        console.log('Found Vite processes by command search');
      }
    }

    if (processes.length === 0) {
      console.log('✅ No Vite development servers found running.');
      return;
    }

    console.log(
      `🎯 Found ${processes.length} Vite development server(s): ${processes.map(p => `${p.pid} (${p.name || 'node'})`).join(', ')}`
    );

    // Kill the processes using cross-platform approach
    for (const proc of processes) {
      try {
        // Use process.kill which works across platforms
        process.kill(proc.pid, 'SIGTERM');
        console.log(`✅ Stopped process ${proc.pid} (${proc.name})`);
      } catch (error) {
        // Try SIGKILL if SIGTERM fails
        try {
          process.kill(proc.pid, 'SIGKILL');
          console.log(`✅ Force stopped process ${proc.pid} (${proc.name})`);
        } catch (killError) {
          console.log(`⚠️  Process ${proc.pid} may have already stopped`);
        }
      }
    }

    console.log('🚀 Vite development servers stopped successfully.');
  } catch (error) {
    console.error('❌ Error stopping development servers:', error.message);
    process.exit(1);
  }
}

stopDevServer();
