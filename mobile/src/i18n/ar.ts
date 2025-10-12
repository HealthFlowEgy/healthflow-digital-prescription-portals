// File: mobile/src/services/i18n.ts
// Purpose: Mobile app internationalization

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import RNRestart from 'react-native-restart';

// Import translations
import ar from '../locales/ar.json';
import en from '../locales/en.json';

const LANGUAGE_KEY = '@language';

const resources = {
  ar: { translation: ar },
  en: { translation: en },
};

export const initI18n = async () => {
  // Get saved language preference
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  const deviceLanguage = 'ar'; // Default to Arabic

  const language = savedLanguage || deviceLanguage;

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: 'en',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
    });

  // Configure RTL for Arabic
  if (language === 'ar') {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } else {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  }

  return language;
};

export const changeLanguage = async (lng: string) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lng);
  await i18n.changeLanguage(lng);

  // Configure RTL
  const isRTL = lng === 'ar';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
    
    // Restart app to apply RTL changes
    RNRestart.Restart();
  }
};

export const getCurrentLanguage = (): string => {
  return i18n.language;
};

export const isRTL = (): boolean => {
  return i18n.language === 'ar';
};

export default i18n;