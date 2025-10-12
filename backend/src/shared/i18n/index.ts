// File: backend/services/i18n/i18n.service.ts
// Purpose: Internationalization service for Arabic support

import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { join } from 'path';

export class I18nService {
  static async initialize() {
    await i18next
      .use(Backend)
      .init({
        lng: 'ar', // Default language
        fallbackLng: 'en',
        supportedLngs: ['ar', 'en'],
        ns: ['common', 'medicines', 'errors', 'notifications'],
        defaultNS: 'common',
        backend: {
          loadPath: join(__dirname, '../../locales/{{lng}}/{{ns}}.json'),
        },
        interpolation: {
          escapeValue: false,
        },
      });

    console.log('✓ i18n service initialized');
  }

  static t(key: string, options?: any): string {
    return i18next.t(key, options);
  }

  static changeLanguage(lng: string): Promise<any> {
    return i18next.changeLanguage(lng);
  }

  static getLanguage(): string {
    return i18next.language;
  }

  static getSupportedLanguages(): string[] {
    return ['ar', 'en'];
  }
}