import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = `mongodb+srv://wjsrsspe:${process.env.MONGODB_PRIVATE_KEY}@cluster0.mongodb.net`;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!process.env.MONGODB_PRIVATE_KEY) {
      console.error('[CheckEmail] MongoDB private key not found in environment');
      return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
    }

    console.log('[CheckEmail] Checking email in MongoDB:', email);

    const client = new MongoClient(MONGODB_URI);
    
    try {
      await client.connect();
      const db = client.db(); // Use default database
      
      // Check profiles collection for the email
      const profile = await db.collection('profiles').findOne({ email: email.toLowerCase() });
      
      console.log('[CheckEmail] Profile found:', profile ? 'YES' : 'NO');
      
      return NextResponse.json({
        found: !!profile,
        email: email.toLowerCase(),
        profileId: profile?._id
      });
      
    } finally {
      await client.close();
    }
    
  } catch (error) {
    console.error('[CheckEmail] Error:', error);
    return NextResponse.json(
      { error: 'Database check failed' },
      { status: 500 }
    );
  }
}