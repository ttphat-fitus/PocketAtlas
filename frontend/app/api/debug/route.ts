import { NextResponse } from 'next/server';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'NOT_SET';
  
  // Test backend connectivity
  let backendStatus = 'UNKNOWN';
  let backendResponse = null;
  
  try {
    const testUrl = `${backendUrl}/`;
    const response = await fetch(testUrl, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    backendStatus = response.ok ? 'REACHABLE' : `ERROR_${response.status}`;
    try {
      backendResponse = await response.json();
    } catch {
      backendResponse = await response.text();
    }
  } catch (error) {
    backendStatus = `UNREACHABLE: ${error instanceof Error ? error.message : String(error)}`;
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'NOT_SET',
      BACKEND_URL: process.env.BACKEND_URL || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV,
    },
    computed: {
      backendUrl,
      backendStatus,
      backendResponse,
    },
    build: {
      nextVersion: process.env.npm_package_version || 'unknown',
    }
  });
}
