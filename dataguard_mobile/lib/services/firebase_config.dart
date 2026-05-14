class FirebaseConfig {
  static const String apiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: '',
  );
  static const String appId = String.fromEnvironment(
    'FIREBASE_APP_ID',
    defaultValue: '',
  );
  static const String projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'gen-lang-client-0211151324',
  );
  static const String authDomain = String.fromEnvironment(
    'FIREBASE_AUTH_DOMAIN',
    defaultValue: 'gen-lang-client-0211151324.firebaseapp.com',
  );
  static const String storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
    defaultValue: 'gen-lang-client-0211151324.firebasestorage.app',
  );
  static const String messagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '764256054221',
  );

  static bool get isConfigured => projectId.isNotEmpty;

  // These values are from the existing .env file
  static const Map<String, dynamic> firebaseOptions = {
    'apiKey': 'AIzaSyDnlBe43hpP8UioIk4hnPP9yGR_W6dywnU',
    'authDomain': 'gen-lang-client-0211151324.firebaseapp.com',
    'projectId': 'gen-lang-client-0211151324',
    'storageBucket': 'gen-lang-client-0211151324.firebasestorage.app',
    'messagingSenderId': '764256054221',
    'appId': '1:764256054221:web:aa72e04980ebc04dd1f284',
  };
}
