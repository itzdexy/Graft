/**
 * Multi-language support and localization system
 * Provides internationalization (i18n) and localization (l10n) capabilities
 */

export interface Locale {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  dateFormat: string;
  timeFormat: string;
  numberFormat: {
    decimalSeparator: string;
    thousandsSeparator: string;
  };
}

export interface Translation {
  [key: string]: string | Translation;
}

export interface LocalizationConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
  autoDetect: boolean;
  persistChoice: boolean;
}

type LocaleData = Map<string, Translation>;

class LocalizationSystem {
  private config: LocalizationConfig;
  private currentLocale: string;
  private translations: LocaleData = new Map();
  private formatters: Map<string, Intl.NumberFormat> = new Map();
  private dateFormatters: Map<string, Intl.DateTimeFormat> = new Map();

  constructor() {
    this.config = this.getDefaultConfig();
    this.currentLocale = this.config.defaultLocale;
    this.initializeLocales();
  }

  /**
   * Initialize supported locales and translations
   */
  private initializeLocales(): void {
    // English (US)
    this.setLocaleData('en-US', {
      common: {
        yes: 'Yes',
        no: 'No',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        search: 'Search',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        warning: 'Warning',
        info: 'Information',
      },
      ui: {
        welcome: 'Welcome to Blink',
        start: 'Start',
        stop: 'Stop',
        settings: 'Settings',
        help: 'Help',
        about: 'About',
        exit: 'Exit',
      },
      commands: {
        run: 'Run',
        build: 'Build',
        test: 'Test',
        deploy: 'Deploy',
        debug: 'Debug',
      },
      errors: {
        fileNotFound: 'File not found',
        permissionDenied: 'Permission denied',
        networkError: 'Network error',
        unknownError: 'Unknown error',
      },
    });

    // Spanish (Spain)
    this.setLocaleData('es-ES', {
      common: {
        yes: 'Sí',
        no: 'No',
        cancel: 'Cancelar',
        confirm: 'Confirmar',
        save: 'Guardar',
        delete: 'Eliminar',
        edit: 'Editar',
        search: 'Buscar',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        warning: 'Advertencia',
        info: 'Información',
      },
      ui: {
        welcome: 'Bienvenido a Blink',
        start: 'Iniciar',
        stop: 'Detener',
        settings: 'Configuración',
        help: 'Ayuda',
        about: 'Acerca de',
        exit: 'Salir',
      },
      commands: {
        run: 'Ejecutar',
        build: 'Construir',
        test: 'Probar',
        deploy: 'Desplegar',
        debug: 'Depurar',
      },
      errors: {
        fileNotFound: 'Archivo no encontrado',
        permissionDenied: 'Permiso denegado',
        networkError: 'Error de red',
        unknownError: 'Error desconocido',
      },
    });

    // French (France)
    this.setLocaleData('fr-FR', {
      common: {
        yes: 'Oui',
        no: 'Non',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        save: 'Enregistrer',
        delete: 'Supprimer',
        edit: 'Modifier',
        search: 'Rechercher',
        loading: 'Chargement...',
        error: 'Erreur',
        success: 'Succès',
        warning: 'Avertissement',
        info: 'Information',
      },
      ui: {
        welcome: 'Bienvenue dans Blink',
        start: 'Démarrer',
        stop: 'Arrêter',
        settings: 'Paramètres',
        help: 'Aide',
        about: 'À propos',
        exit: 'Quitter',
      },
      commands: {
        run: 'Exécuter',
        build: 'Construire',
        test: 'Tester',
        deploy: 'Déployer',
        debug: 'Déboguer',
      },
      errors: {
        fileNotFound: 'Fichier non trouvé',
        permissionDenied: 'Permission refusée',
        networkError: 'Erreur réseau',
        unknownError: 'Erreur inconnue',
      },
    });

    // German (Germany)
    this.setLocaleData('de-DE', {
      common: {
        yes: 'Ja',
        no: 'Nein',
        cancel: 'Abbrechen',
        confirm: 'Bestätigen',
        save: 'Speichern',
        delete: 'Löschen',
        edit: 'Bearbeiten',
        search: 'Suchen',
        loading: 'Laden...',
        error: 'Fehler',
        success: 'Erfolg',
        warning: 'Warnung',
        info: 'Information',
      },
      ui: {
        welcome: 'Willkommen bei Blink',
        start: 'Starten',
        stop: 'Stoppen',
        settings: 'Einstellungen',
        help: 'Hilfe',
        about: 'Über',
        exit: 'Beenden',
      },
      commands: {
        run: 'Ausführen',
        build: 'Erstellen',
        test: 'Testen',
        deploy: 'Bereitstellen',
        debug: 'Debuggen',
      },
      errors: {
        fileNotFound: 'Datei nicht gefunden',
        permissionDenied: 'Zugriff verweigert',
        networkError: 'Netzwerkfehler',
        unknownError: 'Unbekannter Fehler',
      },
    });

    // Japanese (Japan)
    this.setLocaleData('ja-JP', {
      common: {
        yes: 'はい',
        no: 'いいえ',
        cancel: 'キャンセル',
        confirm: '確認',
        save: '保存',
        delete: '削除',
        edit: '編集',
        search: '検索',
        loading: '読み込み中...',
        error: 'エラー',
        success: '成功',
        warning: '警告',
        info: '情報',
      },
      ui: {
        welcome: 'Blinkへようこそ',
        start: '開始',
        stop: '停止',
        settings: '設定',
        help: 'ヘルプ',
        about: 'について',
        exit: '終了',
      },
      commands: {
        run: '実行',
        build: 'ビルド',
        test: 'テスト',
        deploy: 'デプロイ',
        debug: 'デバッグ',
      },
      errors: {
        fileNotFound: 'ファイルが見つかりません',
        permissionDenied: 'アクセス拒否',
        networkError: 'ネットワークエラー',
        unknownError: '不明なエラー',
      },
    });

    // Chinese (Simplified)
    this.setLocaleData('zh-CN', {
      common: {
        yes: '是',
        no: '否',
        cancel: '取消',
        confirm: '确认',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        search: '搜索',
        loading: '加载中...',
        error: '错误',
        success: '成功',
        warning: '警告',
        info: '信息',
      },
      ui: {
        welcome: '欢迎使用 Blink',
        start: '开始',
        stop: '停止',
        settings: '设置',
        help: '帮助',
        about: '关于',
        exit: '退出',
      },
      commands: {
        run: '运行',
        build: '构建',
        test: '测试',
        deploy: '部署',
        debug: '调试',
      },
      errors: {
        fileNotFound: '文件未找到',
        permissionDenied: '权限被拒绝',
        networkError: '网络错误',
        unknownError: '未知错误',
      },
    });

    // Portuguese (Brazil)
    this.setLocaleData('pt-BR', {
      common: {
        yes: 'Sim',
        no: 'Não',
        cancel: 'Cancelar',
        confirm: 'Confirmar',
        save: 'Salvar',
        delete: 'Excluir',
        edit: 'Editar',
        search: 'Pesquisar',
        loading: 'Carregando...',
        error: 'Erro',
        success: 'Sucesso',
        warning: 'Aviso',
        info: 'Informação',
      },
      ui: {
        welcome: 'Bem-vindo ao Blink',
        start: 'Iniciar',
        stop: 'Parar',
        settings: 'Configurações',
        help: 'Ajuda',
        about: 'Sobre',
        exit: 'Sair',
      },
      commands: {
        run: 'Executar',
        build: 'Construir',
        test: 'Testar',
        deploy: 'Implantar',
        debug: 'Depurar',
      },
      errors: {
        fileNotFound: 'Arquivo não encontrado',
        permissionDenied: 'Permissão negada',
        networkError: 'Erro de rede',
        unknownError: 'Erro desconhecido',
      },
    });

    // Russian (Russia)
    this.setLocaleData('ru-RU', {
      common: {
        yes: 'Да',
        no: 'Нет',
        cancel: 'Отмена',
        confirm: 'Подтвердить',
        save: 'Сохранить',
        delete: 'Удалить',
        edit: 'Редактировать',
        search: 'Поиск',
        loading: 'Загрузка...',
        error: 'Ошибка',
        success: 'Успех',
        warning: 'Предупреждение',
        info: 'Информация',
      },
      ui: {
        welcome: 'Добро пожаловать в Blink',
        start: 'Начать',
        stop: 'Остановить',
        settings: 'Настройки',
        help: 'Справка',
        about: 'О программе',
        exit: 'Выход',
      },
      commands: {
        run: 'Запустить',
        build: 'Собрать',
        test: 'Тестировать',
        deploy: 'Развернуть',
        debug: 'Отладка',
      },
      errors: {
        fileNotFound: 'Файл не найден',
        permissionDenied: 'Доступ запрещен',
        networkError: 'Ошибка сети',
        unknownError: 'Неизвестная ошибка',
      },
    });

    // Arabic (Saudi Arabia)
    this.setLocaleData('ar-SA', {
      common: {
        yes: 'نعم',
        no: 'لا',
        cancel: 'إلغاء',
        confirm: 'تأكيد',
        save: 'حفظ',
        delete: 'حذف',
        edit: 'تعديل',
        search: 'بحث',
        loading: 'جاري التحميل...',
        error: 'خطأ',
        success: 'نجح',
        warning: 'تحذير',
        info: 'معلومات',
      },
      ui: {
        welcome: 'مرحباً بك في Blink',
        start: 'بدء',
        stop: 'إيقاف',
        settings: 'الإعدادات',
        help: 'مساعدة',
        about: 'حول',
        exit: 'خروج',
      },
      commands: {
        run: 'تشغيل',
        build: 'بناء',
        test: 'اختبار',
        deploy: 'نشر',
        debug: 'تصحيح',
      },
      errors: {
        fileNotFound: 'الملف غير موجود',
        permissionDenied: 'تم رفض الإذن',
        networkError: 'خطأ في الشبكة',
        unknownError: 'خطأ غير معروف',
      },
    });

    // Hindi (India)
    this.setLocaleData('hi-IN', {
      common: {
        yes: 'हाँ',
        no: 'नहीं',
        cancel: 'रद्द करें',
        confirm: 'पुष्टि करें',
        save: 'सहेजें',
        delete: 'हटाएं',
        edit: 'संपादित करें',
        search: 'खोजें',
        loading: 'लोड हो रहा है...',
        error: 'त्रुटि',
        success: 'सफलता',
        warning: 'चेतावनी',
        info: 'जानकारी',
      },
      ui: {
        welcome: 'Blink में आपका स्वागत है',
        start: 'शुरू करें',
        stop: 'रोकें',
        settings: 'सेटिंग्स',
        help: 'मदद',
        about: 'के बारे में',
        exit: 'बाहर निकलें',
      },
      commands: {
        run: 'चलाएं',
        build: 'बनाएं',
        test: 'परीक्षण',
        deploy: 'तैनात',
        debug: 'डिबग',
      },
      errors: {
        fileNotFound: 'फ़ाइल नहीं मिली',
        permissionDenied: 'अनुमति निषिद्ध',
        networkError: 'नेटवर्क त्रुटि',
        unknownError: 'अज्ञात त्रुटि',
      },
    });
  }

  /**
   * Set translation data for a locale
   */
  setLocaleData(locale: string, data: Translation): void {
    this.translations.set(locale, data);
  }

  /**
   * Get translation for a key
   */
  translate(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = this.translations.get(this.currentLocale);

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to default locale
        value = this.translations.get(this.config.fallbackLocale);
        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k];
          } else {
            return key; // Return key if not found
          }
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters
    if (params) {
      return this.replaceParams(value, params);
    }

    return value;
  }

  /**
   * Replace parameters in translation string
   */
  private replaceParams(str: string, params: Record<string, string | number>): string {
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      return String(params[key] || match);
    });
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (!this.config.supportedLocales.includes(locale)) {
      throw new Error(`Locale ${locale} is not supported`);
    }

    this.currentLocale = locale;
    this.clearFormatters();

    if (this.config.persistChoice) {
      this.saveLocalePreference(locale);
    }
  }

  /**
   * Get current locale
   */
  getLocale(): string {
    return this.currentLocale;
  }

  /**
   * Get supported locales
   */
  getSupportedLocales(): Locale[] {
    const locales: Locale[] = [
      { code: 'en-US', name: 'English', nativeName: 'English', rtl: false, dateFormat: 'MM/DD/YYYY', timeFormat: 'h:mm A', numberFormat: { decimalSeparator: '.', thousandsSeparator: ',' } },
      { code: 'es-ES', name: 'Spanish', nativeName: 'Español', rtl: false, dateFormat: 'DD/MM/YYYY', timeFormat: 'H:mm', numberFormat: { decimalSeparator: ',', thousandsSeparator: '.' } },
      { code: 'fr-FR', name: 'French', nativeName: 'Français', rtl: false, dateFormat: 'DD/MM/YYYY', timeFormat: 'H:mm', numberFormat: { decimalSeparator: ',', thousandsSeparator: ' ' } },
      { code: 'de-DE', name: 'German', nativeName: 'Deutsch', rtl: false, dateFormat: 'DD.MM.YYYY', timeFormat: 'H:mm', numberFormat: { decimalSeparator: ',', thousandsSeparator: '.' } },
      { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', rtl: false, dateFormat: 'YYYY/MM/DD', timeFormat: 'H:mm', numberFormat: { decimalSeparator: '.', thousandsSeparator: ',' } },
      { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', rtl: false, dateFormat: 'YYYY/MM/DD', timeFormat: 'H:mm', numberFormat: { decimalSeparator: '.', thousandsSeparator: ',' } },
      { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', rtl: false, dateFormat: 'DD/MM/YYYY', timeFormat: 'H:mm', numberFormat: { decimalSeparator: ',', thousandsSeparator: '.' } },
      { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', rtl: false, dateFormat: 'DD.MM.YYYY', timeFormat: 'H:mm', numberFormat: { decimalSeparator: ',', thousandsSeparator: ' ' } },
      { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', rtl: true, dateFormat: 'DD/MM/YYYY', timeFormat: 'H:mm', numberFormat: { decimalSeparator: '٫', thousandsSeparator: '٬' } },
      { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', rtl: false, dateFormat: 'DD/MM/YYYY', timeFormat: 'H:mm', numberFormat: { decimalSeparator: '.', thousandsSeparator: ',' } },
    ];

    return locales.filter(l => this.config.supportedLocales.includes(l.code));
  }

  /**
   * Format a number
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    const cacheKey = `${this.currentLocale}-${JSON.stringify(options)}`;
    
    if (!this.formatters.has(cacheKey)) {
      this.formatters.set(cacheKey, new Intl.NumberFormat(this.currentLocale, options));
    }

    return this.formatters.get(cacheKey)!.format(value);
  }

  /**
   * Format a currency
   */
  formatCurrency(value: number, currency: string = 'USD'): string {
    return this.formatNumber(value, {
      style: 'currency',
      currency,
    });
  }

  /**
   * Format a percentage
   */
  formatPercentage(value: number, decimals: number = 2): string {
    return this.formatNumber(value, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /**
   * Format a date
   */
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    const cacheKey = `${this.currentLocale}-${JSON.stringify(options)}`;
    
    if (!this.dateFormatters.has(cacheKey)) {
      this.dateFormatters.set(cacheKey, new Intl.DateTimeFormat(this.currentLocale, options));
    }

    return this.dateFormatters.get(cacheKey)!.format(date);
  }

  /**
   * Format a time
   */
  formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return this.formatDate(date, {
      hour: 'numeric',
      minute: 'numeric',
      ...options,
    });
  }

  /**
   * Format a relative time
   */
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
    const formatter = new Intl.RelativeTimeFormat(this.currentLocale);
    return formatter.format(value, unit);
  }

  /**
   * Detect user's locale from browser
   */
  detectLocale(): string {
    const browserLocale = navigator.language || 'en-US';
    
    // Check if exact match
    if (this.config.supportedLocales.includes(browserLocale)) {
      return browserLocale;
    }

    // Check for language match (without region)
    const language = browserLocale.split('-')[0];
    const matchedLocale = this.config.supportedLocales.find(l => l.startsWith(language));
    
    return matchedLocale || this.config.defaultLocale;
  }

  /**
   * Auto-detect and set locale
   */
  autoDetectLocale(): void {
    if (this.config.autoDetect) {
      const detected = this.detectLocale();
      this.setLocale(detected);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): LocalizationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LocalizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if current locale is RTL
   */
  isRTL(): boolean {
    const locales = this.getSupportedLocales();
    const current = locales.find(l => l.code === this.currentLocale);
    return current ? current.rtl : false;
  }

  /**
   * Clear formatters cache
   */
  private clearFormatters(): void {
    this.formatters.clear();
    this.dateFormatters.clear();
  }

  /**
   * Save locale preference
   */
  private saveLocalePreference(locale: string): void {
    try {
      localStorage.setItem('blink-locale', locale);
    } catch (error) {
      // Ignore storage errors
    }
  }

  /**
   * Load saved locale preference
   */
  loadLocalePreference(): string | null {
    try {
      return localStorage.getItem('blink-locale');
    } catch (error) {
      return null;
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): LocalizationConfig {
    return {
      defaultLocale: 'en-US',
      supportedLocales: [
        'en-US',
        'es-ES',
        'fr-FR',
        'de-DE',
        'ja-JP',
        'zh-CN',
        'pt-BR',
        'ru-RU',
        'ar-SA',
        'hi-IN',
      ],
      fallbackLocale: 'en-US',
      autoDetect: true,
      persistChoice: true,
    };
  }
}

// Global localization system instance
const localization = new LocalizationSystem();

export function translate(key: string, params?: Record<string, string | number>): string {
  return localization.translate(key, params);
}

export function setLocale(locale: string): void {
  localization.setLocale(locale);
}

export function getLocale(): string {
  return localization.getLocale();
}

export function getSupportedLocales(): Locale[] {
  return localization.getSupportedLocales();
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return localization.formatNumber(value, options);
}

export function formatCurrency(value: number, currency?: string): string {
  return localization.formatCurrency(value, currency);
}

export function formatPercentage(value: number, decimals?: number): string {
  return localization.formatPercentage(value, decimals);
}

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return localization.formatDate(date, options);
}

export function formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return localization.formatTime(date, options);
}

export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return localization.formatRelativeTime(value, unit);
}

export function detectLocale(): string {
  return localization.detectLocale();
}

export function autoDetectLocale(): void {
  localization.autoDetectLocale();
}

export function getConfig(): LocalizationConfig {
  return localization.getConfig();
}

export function updateConfig(config: Partial<LocalizationConfig>): void {
  localization.updateConfig(config);
}

export function isRTL(): boolean {
  return localization.isRTL();
}

export function setLocaleData(locale: string, data: Translation): void {
  localization.setLocaleData(locale, data);
}
