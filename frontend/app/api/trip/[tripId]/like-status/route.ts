import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    const response = await fetch(`${BACKEND_URL}/api/trip/${tripId}/like-status?user_id=${userId}`);

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching like status:', error);
    return NextResponse.json({ error: 'Failed to fetch like status' }, { status: 500 });
  }
}
