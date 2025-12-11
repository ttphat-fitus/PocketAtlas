import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/api/user/profile`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    const data = await response.json();
    
    const userId = data.uid || data.user_id;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    const rewardsResponse = await fetch(`${BACKEND_URL}/api/user/${userId}/rewards`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    const rewardsData = await rewardsResponse.json();
    
    return NextResponse.json(rewardsData, { status: rewardsResponse.status });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}
