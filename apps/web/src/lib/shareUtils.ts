/**
 * Utility functions for building and handling share links
 */

type ShareMode = 'heart' | 'poem' | 'both';
type ShareLang = 'en' | 'hi';

/**
 * Build a branded QD Moment share link
 * @param momentId - The moment/reflection ID
 * @param mode - What to share: heart (reflection), poem, or both
 * @param lang - Language: en or hi
 * @returns Full URL to the QD Moment page
 */
export function buildShareLink(momentId: string, mode: ShareMode, lang: ShareLang = 'en'): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_BASE_URL || 'https://quietden.app';
  
  return `${baseUrl}/qd-moment/${momentId}?mode=${mode}&lang=${lang}`;
}

/**
 * Get WhatsApp message text for a given share mode and language
 * @param mode - What to share
 * @param lang - Language
 * @param content - The reflection text and poem
 * @param shareLink - The full share link
 * @returns Formatted WhatsApp message
 */
export function getWhatsAppMessage(
  mode: ShareMode,
  lang: ShareLang,
  content: { text: string; poem?: string },
  shareLink: string
): string {
  let message = '';

  if (lang === 'hi') {
    // Hindi templates
    if (mode === 'heart') {
      message = `दिल का ये छोटा सा टुकड़ा तुम्हारे साथ बाँटना था:\n\n`;
      message += `"${content.text}"\n\n`;
      message += `🔗 ये छोटा सा पल यहाँ रख लो: ${shareLink}`;
    } else if (mode === 'poem') {
      if (content.poem) {
        message = `QuietDen से ये छोटी-सी कविता मिली, तुम्हारा खयाल आ गया:\n\n`;
        message += `"${content.poem}"\n\n`;
        message += `🔗 ये छोटा सा पल यहाँ खोलो: ${shareLink}`;
      } else {
        // Fallback to heart if no poem
        message = `दिल का ये छोटा सा टुकड़ा तुम्हारे साथ बाँटना था:\n\n`;
        message += `"${content.text}"\n\n`;
        message += `🔗 ये छोटा सा पल यहाँ रख लो: ${shareLink}`;
      }
    } else {
      // both
      message = `काफ़ी समय से दिल में ये बातें घूम रही हैं:\n\n`;
      message += `"${content.text}"\n\n`;
      if (content.poem) {
        message += `और उनसे ये छोटी-सी कविता निकली:\n\n`;
        message += `"${content.poem}"\n\n`;
      }
      message += `🔗 ये QuietDen वाला पल अपने पास रख लो: ${shareLink}`;
    }
  } else {
    // English templates
    if (mode === 'heart') {
      message = `I wanted to share this little piece of my heart with you:\n\n`;
      message += `"${content.text}"\n\n`;
      message += `🔗 this tiny piece of my heart: ${shareLink}`;
    } else if (mode === 'poem') {
      if (content.poem) {
        message = `Here's a small poem that's been sitting with me:\n\n`;
        message += `"${content.poem}"\n\n`;
        message += `🔗 open this tiny moment: ${shareLink}`;
      } else {
        // Fallback to heart if no poem
        message = `I wanted to share this little piece of my heart with you:\n\n`;
        message += `"${content.text}"\n\n`;
        message += `🔗 this tiny piece of my heart: ${shareLink}`;
      }
    } else {
      // both
      message = `Here's what's been on my mind:\n\n`;
      message += `"${content.text}"\n\n`;
      if (content.poem) {
        message += `And this is the little poem that grew from it:\n\n`;
        message += `"${content.poem}"\n\n`;
      }
      message += `🔗 keep this tiny moment with you: ${shareLink}`;
    }
  }

  return message;
}
