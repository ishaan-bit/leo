import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Song Recommendation Worker (1960-1975 Era)
 * 
 * Analyzes Stage-1 emotion data and returns two era-specific songs:
 * - 1 Hindi track (film/ghazal/classical-fusion)
 * - 1 English track (pop/folk/rock/soul)
 * 
 * POST /api/recommend-songs
 * Body: { rid: string, refresh?: boolean }
 */

interface SongPick {
  title: string;
  artist: string;
  year: number;
  youtube_url: string;
  source_confidence: 'high' | 'medium' | 'low';
  why: string;
}

interface SongRecommendation {
  rid: string;
  moment_id: string;
  lang_default: 'en' | 'hi';
  tracks: {
    en: SongPick;
    hi: SongPick;
  };
  embed: {
    mode: 'youtube_iframe';
    embed_when_lang_is: {
      en: string;
      hi: string;
    };
  };
  meta: {
    valence_bucket: 'negative' | 'neutral' | 'positive';
    arousal_bucket: 'low' | 'medium' | 'high';
    mood_cell: string;
    picked_at: string;
    version: string;
  };
}

// Era-specific song database (1960-1975)
// Organized by mood cells (valence × arousal)
const SONG_DATABASE = {
  // Positive × Low → calm/soothing/accepting
  'positive-low': {
    en: [
      { title: 'The Sound of Silence', artist: 'Simon & Garfunkel', year: 1965, url: 'https://www.youtube.com/watch?v=4fWyzwo1xg0', why: 'Gentle, introspective folk with warm acceptance' },
      { title: 'Here Comes the Sun', artist: 'The Beatles', year: 1969, url: 'https://www.youtube.com/watch?v=KQetemT1sWc', why: 'Soft, hopeful melody with gentle optimism' },
      { title: 'Both Sides Now', artist: 'Joni Mitchell', year: 1969, url: 'https://www.youtube.com/watch?v=aCnf46boC3I', why: 'Calm reflection with positive resolution' },
    ],
    hi: [
      { title: 'Lag Jaa Gale', artist: 'Lata Mangeshkar', year: 1964, url: 'https://www.youtube.com/watch?v=Q8Pk5Bq1IVo', why: 'Tender, soothing ghazal with warmth and acceptance' },
      { title: 'Pyar Hua Iqrar Hua', artist: 'Lata & Manna Dey', year: 1955, url: 'https://www.youtube.com/watch?v=kV4I_M1UmTI', why: 'Soft, romantic melody with gentle positivity' },
      { title: 'Aaj Phir Jeene Ki Tamanna Hai', artist: 'Lata Mangeshkar', year: 1965, url: 'https://www.youtube.com/watch?v=dQn6RXJhoUU', why: 'Calm, hopeful song with soothing arrangement' },
    ],
  },
  
  // Positive × Medium → warm/uplifting/hopeful
  'positive-medium': {
    en: [
      { title: 'Here Comes the Sun', artist: 'The Beatles', year: 1969, url: 'https://www.youtube.com/watch?v=KQetemT1sWc', why: 'Warm, uplifting melody with steady hopefulness' },
      { title: 'Lean on Me', artist: 'Bill Withers', year: 1972, url: 'https://www.youtube.com/watch?v=fOZ-MySzAac', why: 'Reassuring soul with warm community energy' },
      { title: 'What a Wonderful World', artist: 'Louis Armstrong', year: 1967, url: 'https://www.youtube.com/watch?v=VqhCQZaH4Vs', why: 'Gentle optimism with steady warmth' },
    ],
    hi: [
      { title: 'Yeh Dosti', artist: 'Kishore Kumar & Manna Dey', year: 1975, url: 'https://www.youtube.com/watch?v=vbINO5b5pNI', why: 'Uplifting friendship anthem with warm energy' },
      { title: 'Pal Pal Dil Ke Paas', artist: 'Kishore Kumar', year: 1973, url: 'https://www.youtube.com/watch?v=SIW72aF0k0M', why: 'Hopeful romantic melody with steady warmth' },
      { title: 'Zindagi Kaisi Hai Paheli', artist: 'Manna Dey', year: 1971, url: 'https://www.youtube.com/watch?v=KjqA4hCIQPk', why: 'Reflective yet warm contemplation' },
    ],
  },
  
  // Positive × High → celebratory/bright/energetic
  'positive-high': {
    en: [
      { title: 'Good Vibrations', artist: 'The Beach Boys', year: 1966, url: 'https://www.youtube.com/watch?v=Eab_beh07HU', why: 'Bright, energetic celebration with high arousal' },
      { title: 'I Want You Back', artist: 'The Jackson 5', year: 1969, url: 'https://www.youtube.com/watch?v=s3Q80mk7bxE', why: 'Joyful Motown energy with celebratory feel' },
      { title: 'Dancing in the Street', artist: 'Martha and the Vandellas', year: 1964, url: 'https://www.youtube.com/watch?v=CdvITn5cAVc', why: 'High-energy celebration with bright positivity' },
    ],
    hi: [
      { title: 'Aap Jaisa Koi', artist: 'Nazia Hassan', year: 1980, url: 'https://www.youtube.com/watch?v=nAz-FhSf8R8', why: 'Energetic disco-pop with celebratory mood' }, // Note: 1980, slightly outside era
      { title: 'Dum Maro Dum', artist: 'Asha Bhosle', year: 1971, url: 'https://www.youtube.com/watch?v=2pGL7K3W_Vw', why: 'High-energy psychedelic track with bright intensity' },
      { title: 'Mera Naam Joker', artist: 'Mukesh', year: 1970, url: 'https://www.youtube.com/watch?v=VLl7aX5e4Ik', why: 'Upbeat, celebratory energy despite underlying complexity' },
    ],
  },
  
  // Neutral × Low → contemplative/ambient/reflective
  'neutral-low': {
    en: [
      { title: 'The Boxer', artist: 'Simon & Garfunkel', year: 1969, url: 'https://www.youtube.com/watch?v=l3LFML_pxlY', why: 'Contemplative folk with gentle reflection' },
      { title: 'Suzanne', artist: 'Leonard Cohen', year: 1967, url: 'https://www.youtube.com/watch?v=svitEEpI07E', why: 'Quiet, reflective storytelling with low energy' },
      { title: 'Northern Sky', artist: 'Nick Drake', year: 1970, url: 'https://www.youtube.com/watch?v=BNnW1pZ6eVQ', why: 'Ambient, contemplative guitar with soft reflection' },
    ],
    hi: [
      { title: 'Kahin Door Jab Din Dhal Jaye', artist: 'Mukesh', year: 1970, url: 'https://www.youtube.com/watch?v=IFjj10s2Kew', why: 'Melancholic reflection with quiet contemplation' },
      { title: 'Chalte Chalte', artist: 'Kishore Kumar', year: 1976, url: 'https://www.youtube.com/watch?v=j24RiGnWlDI', why: 'Gentle, reflective wandering with ambient feel' }, // Note: 1976, slightly outside
      { title: 'Tere Bina Zindagi Se', artist: 'Lata & Kishore', year: 1975, url: 'https://www.youtube.com/watch?v=vbINO5b5pNI', why: 'Soft, contemplative duet with quiet longing' },
    ],
  },
  
  // Neutral × Medium → steady/grounded/soft-groove
  'neutral-medium': {
    en: [
      { title: 'Fire and Rain', artist: 'James Taylor', year: 1970, url: 'https://www.youtube.com/watch?v=C3uaXCJcRrE', why: 'Steady, grounded folk with balanced energy' },
      { title: 'Ventura Highway', artist: 'America', year: 1972, url: 'https://www.youtube.com/watch?v=p0PjECSyJ7w', why: 'Soft groove with steady, balanced feel' },
      { title: 'Blackbird', artist: 'The Beatles', year: 1968, url: 'https://www.youtube.com/watch?v=Man4Xw8Xypo', why: 'Grounded, steady guitar with gentle resolve' },
    ],
    hi: [
      { title: 'Mere Sapno Ki Rani', artist: 'Kishore Kumar', year: 1969, url: 'https://www.youtube.com/watch?v=lS2m0ysFJns', why: 'Steady romantic melody with soft groove' },
      { title: 'Piya Tu Ab To Aaja', artist: 'Asha Bhosle', year: 1971, url: 'https://www.youtube.com/watch?v=BKhiK2F6uxc', why: 'Balanced tempo with grounded longing' },
      { title: 'Raina Beeti Jaye', artist: 'Lata Mangeshkar', year: 1969, url: 'https://www.youtube.com/watch?v=JFbsrKsw8W0', why: 'Soft, steady night melody with medium energy' },
    ],
  },
  
  // Neutral × High → confident/motivating
  'neutral-high': {
    en: [
      { title: 'Born to Be Wild', artist: 'Steppenwolf', year: 1968, url: 'https://www.youtube.com/watch?v=rMbATaj7Il8', why: 'Confident rock with high, motivating energy' },
      { title: 'Get Up (I Feel Like Being a) Sex Machine', artist: 'James Brown', year: 1970, url: 'https://www.youtube.com/watch?v=dB9lJ1V1Pd8', why: 'High-energy funk with driving confidence' },
      { title: "Ain't No Mountain High Enough", artist: 'Marvin Gaye & Tammi Terrell', year: 1967, url: 'https://www.youtube.com/watch?v=Xz-UvQYAmbg', why: 'Motivating soul with confident energy' },
    ],
    hi: [
      { title: 'O Haseena Zulfon Wali', artist: 'Mohammed Rafi', year: 1966, url: 'https://www.youtube.com/watch?v=4bj9pW6iNQs', why: 'Confident, energetic retro melody' },
      { title: 'Bachna Ae Haseeno', artist: 'Kishore Kumar', year: 1977, url: 'https://www.youtube.com/watch?v=M1ufpULeDsk', why: 'High-energy, confident dance number' }, // Note: 1977, slightly outside
      { title: 'Yeh Shaam Mastani', artist: 'Kishore Kumar', year: 1975, url: 'https://www.youtube.com/watch?v=lVdtAhLNzYI', why: 'Motivating, upbeat energy with confidence' },
    ],
  },
  
  // Negative × Low → tender/melancholic/nostalgic
  'negative-low': {
    en: [
      { title: 'The Sound of Silence', artist: 'Simon & Garfunkel', year: 1965, url: 'https://www.youtube.com/watch?v=4fWyzwo1xg0', why: 'Melancholic introspection with tender delivery' },
      { title: 'Hallelujah', artist: 'Leonard Cohen', year: 1984, url: 'https://www.youtube.com/watch?v=YrLk4vdY28Q', why: 'Tender, melancholic meditation with low energy' }, // Note: 1984, outside era
      { title: 'Pink Moon', artist: 'Nick Drake', year: 1972, url: 'https://www.youtube.com/watch?v=irq959oNVww', why: 'Nostalgic, melancholic guitar with quiet sadness' },
    ],
    hi: [
      { title: 'Tum Pukar Lo', artist: 'Hemant Kumar', year: 1969, url: 'https://www.youtube.com/watch?v=F9aonNHJdhY', why: 'Tender ghazal with melancholic longing' },
      { title: 'Ajeeb Dastan Hai Yeh', artist: 'Lata Mangeshkar', year: 1960, url: 'https://www.youtube.com/watch?v=i9u15g0VNpg', why: 'Melancholic narrative with nostalgic tenderness' },
      { title: 'Hothon Pe Aisi Baat', artist: 'Lata Mangeshkar', year: 1960, url: 'https://www.youtube.com/watch?v=jEjKz2BGj7w', why: 'Soft, melancholic longing with gentle sadness' },
    ],
  },
  
  // Negative × Medium → longing/resolve/bittersweet
  'negative-medium': {
    en: [
      { title: 'Eleanor Rigby', artist: 'The Beatles', year: 1966, url: 'https://www.youtube.com/watch?v=HuS5NuXRb5Y', why: 'Bittersweet narrative with medium energy and resolve' },
      { title: "Ain't No Sunshine", artist: 'Bill Withers', year: 1971, url: 'https://www.youtube.com/watch?v=tIdIqbv7SPo', why: 'Longing soul with bittersweet acceptance' },
      { title: 'A Whiter Shade of Pale', artist: 'Procol Harum', year: 1967, url: 'https://www.youtube.com/watch?v=Mb3iPP-tHdA', why: 'Bittersweet mystery with steady, longing energy' },
    ],
    hi: [
      { title: 'Chalte Chalte Mere Ye Geet', artist: 'Kishore Kumar', year: 1972, url: 'https://www.youtube.com/watch?v=VE5XgzRaEQY', why: 'Bittersweet journey with longing and resolve' },
      { title: 'Kora Kagaz Tha Ye Man Mera', artist: 'Lata & Kishore', year: 1974, url: 'https://www.youtube.com/watch?v=EHXfYX3hVHs', why: 'Longing duet with medium-energy acceptance' },
      { title: 'Chingari Koi Bhadke', artist: 'Kishore Kumar', year: 1970, url: 'https://www.youtube.com/watch?v=z6B7qQa2SRo', why: 'Bittersweet longing with steady emotional energy' },
    ],
  },
  
  // Negative × High → defiant/intense/cathartic
  'negative-high': {
    en: [
      { title: 'Fortunate Son', artist: 'Creedence Clearwater Revival', year: 1969, url: 'https://www.youtube.com/watch?v=ec0XKhAHR5I', why: 'Defiant protest with high, intense energy' },
      { title: 'Sympathy for the Devil', artist: 'The Rolling Stones', year: 1968, url: 'https://www.youtube.com/watch?v=GgnClrx8N2k', why: 'Intense, cathartic rock with defiant edge' },
      { title: 'Gimme Shelter', artist: 'The Rolling Stones', year: 1969, url: 'https://www.youtube.com/watch?v=RbmS3tQJ7Os', why: 'High-energy catharsis with underlying darkness' },
    ],
    hi: [
      { title: 'Yeh Desh Hai Veer Jawanon Ka', artist: 'Mohammed Rafi', year: 1961, url: 'https://www.youtube.com/watch?v=C5fqwYC8jc4', why: 'Defiant patriotic anthem with intense energy' },
      { title: 'Jai Jai Shiv Shankar', artist: 'Lata & Kishore', year: 1974, url: 'https://www.youtube.com/watch?v=mJa0_Z1Fv9Y', why: 'High-energy devotional with cathartic intensity' },
      { title: 'Mehbooba Mehbooba', artist: 'R.D. Burman', year: 1975, url: 'https://www.youtube.com/watch?v=lWVFPPrMZ_c', why: 'Intense, driving rhythm with defiant passion' },
    ],
  },
};

function getBuckets(valence: number, arousal: number) {
  const valenceBucket: 'negative' | 'neutral' | 'positive' = 
    valence <= -0.15 ? 'negative' : 
    valence >= 0.15 ? 'positive' : 
    'neutral';
  
  const arousalBucket: 'low' | 'medium' | 'high' = 
    arousal <= 0.33 ? 'low' : 
    arousal >= 0.67 ? 'high' : 
    'medium';
  
  return { valenceBucket, arousalBucket };
}

function getMoodCell(valenceBucket: string, arousalBucket: string): string {
  return `${valenceBucket}-${arousalBucket}`;
}

function pickSong(moodCell: string, language: 'en' | 'hi'): SongPick {
  const candidates = SONG_DATABASE[moodCell as keyof typeof SONG_DATABASE]?.[language];
  
  if (!candidates || candidates.length === 0) {
    // Fallback to neutral-medium
    const fallback = SONG_DATABASE['neutral-medium'][language][0];
    return {
      title: fallback.title,
      artist: fallback.artist,
      year: fallback.year,
      youtube_url: fallback.url,
      source_confidence: 'medium',
      why: `Fallback: ${fallback.why}`,
    };
  }
  
  // Pick randomly from candidates (with rotation logic later)
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  
  return {
    title: pick.title,
    artist: pick.artist,
    year: pick.year,
    youtube_url: pick.url,
    source_confidence: 'high',
    why: pick.why,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rid, refresh = false } = body;

    if (!rid) {
      return NextResponse.json(
        { error: 'rid is required' },
        { status: 400 }
      );
    }

    // Check cache first (unless refresh requested)
    const cacheKey = `songs:${rid}`;
    if (!refresh) {
      const cached = await kv.get<SongRecommendation>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Fetch reflection data from Upstash
    const reflection = await kv.get<any>(`reflection:${rid}`);
    
    if (!reflection) {
      return NextResponse.json(
        { error: 'Reflection not found' },
        { status: 404 }
      );
    }

    // Extract Stage-1 emotion data
    const valence = reflection.valence ?? 0;
    const arousal = reflection.arousal ?? 0.5;
    const primary = reflection.primary_emotion || 'neutral';
    
    // Calculate mood buckets
    const { valenceBucket, arousalBucket } = getBuckets(valence, arousal);
    const moodCell = getMoodCell(valenceBucket, arousalBucket);
    
    // Pick songs
    const enSong = pickSong(moodCell, 'en');
    const hiSong = pickSong(moodCell, 'hi');
    
    // Determine default language from locale (if available)
    const locale = reflection.client_context?.locale || 'en-US';
    const langDefault: 'en' | 'hi' = locale.startsWith('hi') ? 'hi' : 'en';
    
    // Build response
    const recommendation: SongRecommendation = {
      rid,
      moment_id: rid,
      lang_default: langDefault,
      tracks: {
        en: enSong,
        hi: hiSong,
      },
      embed: {
        mode: 'youtube_iframe',
        embed_when_lang_is: {
          en: enSong.youtube_url,
          hi: hiSong.youtube_url,
        },
      },
      meta: {
        valence_bucket: valenceBucket,
        arousal_bucket: arousalBucket,
        mood_cell: moodCell,
        picked_at: new Date().toISOString(),
        version: 'song-worker-v1',
      },
    };
    
    // Cache for 24 hours
    await kv.set(cacheKey, recommendation, { ex: 24 * 60 * 60 });
    
    return NextResponse.json(recommendation);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[RECOMMEND-SONGS]', errorMessage);
    
    return NextResponse.json(
      { error: 'Failed to generate song recommendations', details: errorMessage },
      { status: 500 }
    );
  }
}
