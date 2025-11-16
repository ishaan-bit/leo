import { Metadata } from 'next';

export async function generateMetadata({ 
  params,
  searchParams 
}: { 
  params: { momentId: string },
  searchParams: { mode?: string, lang?: string }
}): Promise<Metadata> {
  const mode = searchParams.mode || 'both';
  const lang = searchParams.lang || 'en';
  const isHindi = lang === 'hi';

  // Get mode-specific descriptions
  const getTitle = () => {
    if (isHindi) return 'आपके लिए एक शांत पल।';
    return 'A quiet moment for you.';
  };

  const getDescription = () => {
    if (mode === 'heart') {
      return isHindi
        ? 'किसी ने अपने महसूस किए हुए का एक हिस्सा आपके साथ बाँटा है।'
        : 'Someone trusted you with a piece of what they\'re feeling.';
    } else if (mode === 'poem') {
      return isHindi
        ? 'किसी ने QuietDen की छोटी-सी कविता आपके साथ बाँटी है।'
        : 'Someone shared a small QuietDen poem with you.';
    } else {
      return isHindi
        ? 'किसी ने अपनी बात और उससे निकली कविता — दोनों आपके लिए भेजे हैं।'
        : 'Someone shared both their words and the poem that grew out of them.';
    }
  };

  return {
    title: getTitle(),
    description: getDescription(),
    openGraph: {
      title: getTitle(),
      description: getDescription(),
      type: 'website',
      locale: isHindi ? 'hi_IN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: getTitle(),
      description: getDescription(),
    },
  };
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
