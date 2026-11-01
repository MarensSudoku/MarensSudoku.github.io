// Shared language versions; regional browser settings map to the closest one.
export const LOCALES = {
  de: { name: 'Deutsch', flag: 'de', tag: 'de-DE' },
  en: { name: 'English', flag: 'gb', tag: 'en-GB' },
  es: { name: 'Español', flag: 'es', tag: 'es-ES' },
  fr: { name: 'Français', flag: 'fr', tag: 'fr-FR' },
  it: { name: 'Italiano', flag: 'it', tag: 'it-IT' },
  pt: { name: 'Português (Portugal)', flag: 'pt', tag: 'pt-PT' },
  'pt-BR': { name: 'Português (Brasil)', flag: 'br', tag: 'pt-BR' },
  nl: { name: 'Nederlands', flag: 'nl', tag: 'nl-NL' },
  da: { name: 'Dansk', flag: 'dk', tag: 'da-DK' },
  sv: { name: 'Svenska', flag: 'se', tag: 'sv-SE' },
  fi: { name: 'Suomi', flag: 'fi', tag: 'fi-FI' },
  pl: { name: 'Polski', flag: 'pl', tag: 'pl-PL' },
  cs: { name: 'Čeština', flag: 'cz', tag: 'cs-CZ' },
  hu: { name: 'Magyar', flag: 'hu', tag: 'hu-HU' },
  ro: { name: 'Română', flag: 'ro', tag: 'ro-RO' },
  lv: { name: 'Latviešu', flag: 'lv', tag: 'lv-LV' },
  lt: { name: 'Lietuvių', flag: 'lt', tag: 'lt-LT' },
  ru: { name: 'Русский', flag: 'ru', tag: 'ru-RU' },
  uk: { name: 'Українська', flag: 'ua', tag: 'uk-UA' },
  tr: { name: 'Türkçe', flag: 'tr', tag: 'tr-TR' },
  he: { name: 'עברית', flag: 'il', tag: 'he-IL', dir: 'rtl' },
  hi: { name: 'हिन्दी', flag: 'in', tag: 'hi-IN' },
  id: { name: 'Bahasa Indonesia', flag: 'id', tag: 'id-ID' },
  vi: { name: 'Tiếng Việt', flag: 'vn', tag: 'vi-VN' },
  ja: { name: '日本語', flag: 'jp', tag: 'ja-JP' },
  ko: { name: '한국어', flag: 'kr', tag: 'ko-KR' },
  'zh-Hans': { name: '简体中文', flag: 'cn', tag: 'zh-CN' },
  'zh-Hant': { name: '繁體中文', flag: 'tw', tag: 'zh-TW' },
};

export function resolveLanguage(preferences = []) {
  for (const value of preferences) {
    if (typeof value !== 'string') continue;
    const tag = value.toLowerCase().replaceAll('_', '-'), base = tag.split('-')[0];
    const code = base === 'zh' ? (/(?:^|-)hans(?:-|$)/.test(tag) ? 'zh-Hans' : /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(tag) ? 'zh-Hant' : 'zh-Hans')
      : base === 'pt' && tag.split('-')[1] === 'br' ? 'pt-BR' : { iw:'he', in:'id' }[base] || base;
    if (Object.hasOwn(LOCALES, code)) return code;
  }
  return 'en';
}
