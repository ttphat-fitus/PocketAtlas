import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Extract token and decode to get userId
    const token = authHeader.replace('Bearer ', '');
    
    // For now, call backend which should extract userId from token
    // We need to create a new endpoint or modify the existing one
    // Let's call profile first to get userId
    const profileResponse = await fetch(`${BACKEND_URL}/api/user/profile`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'Failed to get profile' }, { status: profileResponse.status });
    }

    const profileData = await profileResponse.json();
    const profile = profileData.profile || profileData;
    const userId = profile.uid || profile.user_id || profile.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found in profile' }, { status: 400 });
    }

    const statsResponse = await fetch(`${BACKEND_URL}/api/user/${userId}/stats`);

    if (!statsResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: statsResponse.status });
    }

    const statsData = await statsResponse.json();
    
    return NextResponse.json(statsData, { status: 200 });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
