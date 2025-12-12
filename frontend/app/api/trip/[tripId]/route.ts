import { NextRequest, NextResponse } from 'next/server';

// Server-side can access NEXT_PUBLIC_ vars, but also check non-public version
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ tripId: string }> }
) {
  const params = await segmentData.params;
  try {
    const { tripId } = params;
    const authHeader = request.headers.get('authorization');
    
    console.log('[API Route] GET /api/trip/[tripId]');
    console.log('Backend URL:', BACKEND_URL);
    console.log('Trip ID:', tripId);
    console.log('Has Auth:', !!authHeader);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const backendEndpoint = `${BACKEND_URL}/api/trip/${tripId}`;
    console.log('Fetching from:', backendEndpoint);
    
    const response = await fetch(backendEndpoint, {
      headers,
      cache: 'no-store',
    });

    console.log('Backend response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: errorText || 'Failed to fetch trip' },
        { 
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }

    const data = await response.json();
    console.log('Successfully fetched trip data');
    
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error) {
    console.error('Critical error in API route:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ 
      error: 'Failed to fetch trip', 
      details: error instanceof Error ? error.message : String(error),
      backend_url: BACKEND_URL 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ tripId: string }> }
) {
  const params = await segmentData.params;
  try {
    const { tripId } = params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/api/trip/${tripId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
