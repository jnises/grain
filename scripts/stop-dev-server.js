#!/usr/bin/env node

/**
 * Safely stops Vite development servers by targeting only processes using Vite's default ports.
 * This avoids accidentally killing other processes that might have "vite" in their command line.
 * 
 * Targets ports:
 * - 5173: Vite's default development server port
 * - 5174: Common fallback port when 5173 is in use
 * 
 * Usage: npm run dev:stop
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const VITE_PORTS = [5173, 5174];

async function stopDevServer() {
  try {
    console.log('🔍 Checking for running Vite development servers...');
    
    // Find processes using Vite ports
    const portList = VITE_PORTS.join(',');
    const { stdout } = await execAsync(`lsof -ti:${portList}`);
    
    if (!stdout.trim()) {
      console.log('✅ No Vite development servers found running.');
      return;
    }
    
    const pids = stdout.trim().split('\n').filter(pid => pid);
    console.log(`🎯 Found ${pids.length} process(es) using Vite ports: ${pids.join(', ')}`);
    
    // Kill the processes
    for (const pid of pids) {
      try {
        await execAsync(`kill -9 ${pid}`);
        console.log(`✅ Stopped process ${pid}`);
      } catch (error) {
        console.log(`⚠️  Process ${pid} may have already stopped`);
      }
    }
    
    console.log('🚀 Vite development servers stopped successfully.');
    
  } catch (error) {
    // lsof returns exit code 1 when no processes are found, which is normal
    if (error.code === 1) {
      console.log('✅ No Vite development servers found running.');
    } else {
      console.error('❌ Error stopping development servers:', error.message);
      process.exit(1);
    }
  }
}

stopDevServer();
