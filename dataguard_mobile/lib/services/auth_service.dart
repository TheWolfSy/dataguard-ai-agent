import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_config.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  FirebaseAuth? _auth;

  Future<FirebaseAuth> get _firebaseAuth async {
    if (_auth != null) return _auth!;
    if (Firebase.apps.isNotEmpty) {
      _auth = FirebaseAuth.instance;
    } else {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: FirebaseConfig.apiKey.isNotEmpty
              ? FirebaseConfig.apiKey
              : FirebaseConfig.firebaseOptions['apiKey'] as String,
          appId: FirebaseConfig.appId.isNotEmpty
              ? FirebaseConfig.appId
              : FirebaseConfig.firebaseOptions['appId'] as String,
          projectId: FirebaseConfig.projectId.isNotEmpty
              ? FirebaseConfig.projectId
              : FirebaseConfig.firebaseOptions['projectId'] as String,
          authDomain: FirebaseConfig.authDomain.isNotEmpty
              ? FirebaseConfig.authDomain
              : FirebaseConfig.firebaseOptions['authDomain'] as String,
          storageBucket: FirebaseConfig.storageBucket.isNotEmpty
              ? FirebaseConfig.storageBucket
              : FirebaseConfig.firebaseOptions['storageBucket'] as String,
          messagingSenderId: FirebaseConfig.messagingSenderId.isNotEmpty
              ? FirebaseConfig.messagingSenderId
              : FirebaseConfig.firebaseOptions['messagingSenderId'] as String,
        ),
      );
      _auth = FirebaseAuth.instance;
    }
    return _auth!;
  }

  User? get currentUser => _auth?.currentUser;

  Future<UserCredential> login(String email, String password) async {
    final auth = await _firebaseAuth;
    return auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<UserCredential> register(String email, String password) async {
    final auth = await _firebaseAuth;
    return auth.createUserWithEmailAndPassword(email: email, password: password);
  }

  Future<void> sendPasswordReset(String email) async {
    final auth = await _firebaseAuth;
    await auth.sendPasswordResetEmail(email: email);
  }

  Future<void> logout() async {
    final auth = await _firebaseAuth;
    await auth.signOut();
  }

  Stream<User?> get authStateChanges {
    if (_auth != null) return _auth!.authStateChanges();
    return FirebaseAuth.instance.authStateChanges();
  }
}
