import { NextRequest, NextResponse } from 'next/server';

// WebSocket server URL - update this to match your server
const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Only need sessionId - everything else is stored in the session
    const sessionId = searchParams.get('sessionid');

    // Validate required parameter
    if (!sessionId) {
      return NextResponse.json({
        error: 'Missing required parameter: sessionid',
        example: '/api/send/?sessionid=your-session-id'
      }, { status: 400 });
    }

    console.log(`🚀 Fetching session data for: ${sessionId}`);

    // Fetch session data from WebSocket server
    try {
      const response = await fetch(`${WS_SERVER_URL}/session/${sessionId}/transaction`);
      
      if (!response.ok) {
        return NextResponse.json({
          error: 'Session not found or no transaction data',
          sessionId: sessionId,
          message: 'Make sure the session was created by the bot with transaction data'
        }, { status: 404 });
      }

      const sessionData = await response.json();
      
      console.log('📦 Session data fetched:', {
        sessionId,
        hasTransactionData: !!sessionData.transactionData
      });

      // Create wallet URL with just session ID
      const walletUrl = `${request.nextUrl.origin}?sessionId=${sessionId}`;

      // Return success response
      return NextResponse.json({
        success: true,
        sessionId: sessionId,
        walletUrl: walletUrl,
        transactionData: sessionData.transactionData,
        sessionStatus: sessionData.status,
        message: `Transaction ready. User should visit wallet URL to complete.`,
        timestamp: new Date().toISOString()
      });

    } catch (fetchError) {
      console.error('Error fetching session data:', fetchError);
      return NextResponse.json({
        error: 'Could not fetch session data',
        sessionId: sessionId,
        message: 'Make sure WebSocket server is running and session exists',
        serverUrl: WS_SERVER_URL
      }, { status: 503 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    // Validate required field
    if (!sessionId) {
      return NextResponse.json({
        error: 'Missing required field: sessionId',
        example: '{ "sessionId": "your-session-id" }'
      }, { status: 400 });
    }

    console.log(`🚀 POST: Fetching session data for: ${sessionId}`);

    // Fetch session data from WebSocket server
    try {
      const response = await fetch(`${WS_SERVER_URL}/session/${sessionId}/transaction`);
      
      if (!response.ok) {
        return NextResponse.json({
          error: 'Session not found or no transaction data',
          sessionId: sessionId,
          message: 'Make sure the session was created by the bot with transaction data'
        }, { status: 404 });
      }

      const sessionData = await response.json();
      
      console.log('📦 Session data fetched via POST:', {
        sessionId,
        hasTransactionData: !!sessionData.transactionData
      });

      // Create wallet URL
      const walletUrl = `${request.nextUrl.origin}?sessionId=${sessionId}`;

      return NextResponse.json({
        success: true,
        sessionId: sessionId,
        walletUrl: walletUrl,
        transactionData: sessionData.transactionData,
        sessionStatus: sessionData.status,
        message: `Transaction ready. User should visit wallet URL to complete.`,
        timestamp: new Date().toISOString()
      });

    } catch (fetchError) {
      console.error('Error fetching session data:', fetchError);
      return NextResponse.json({
        error: 'Could not fetch session data',
        sessionId: sessionId,
        message: 'Make sure WebSocket server is running and session exists',
        serverUrl: WS_SERVER_URL
      }, { status: 503 });
    }

  } catch (error) {
    console.error('POST API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 