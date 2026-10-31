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
