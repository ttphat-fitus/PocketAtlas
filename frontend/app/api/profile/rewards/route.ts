import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Get profile to extract userId
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
      console.error('Profile data:', profileData);
      return NextResponse.json({ error: 'User ID not found in profile' }, { status: 400 });
    }

    const rewardsResponse = await fetch(`${BACKEND_URL}/api/user/${userId}/rewards`);

    if (!rewardsResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: rewardsResponse.status });
    }

    const rewardsData = await rewardsResponse.json();
    
    return NextResponse.json(rewardsData, { status: 200 });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}
