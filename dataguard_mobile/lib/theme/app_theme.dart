import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: 'sans-serif',
      colorScheme: ColorScheme.dark(
        primary: DGColors.accent,
        secondary: DGColors.blue,
        surface: DGColors.surfaceDark,
        error: DGColors.error,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: DGColors.textDark,
      ),
      scaffoldBackgroundColor: DGColors.surfaceDarker,
      appBarTheme: const AppBarTheme(
        backgroundColor: DGColors.surfaceDarker,
        foregroundColor: DGColors.textDark,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: DGColors.surfaceCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: DGColors.borderBlue, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withAlpha(13),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: DGColors.borderBlueStrong),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: DGColors.borderBlueStrong),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: DGColors.blue, width: 1.5),
        ),
        hintStyle: const TextStyle(color: DGColors.textMutedDark, fontSize: 13),
        labelStyle: const TextStyle(color: DGColors.textMutedDark),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: DGColors.accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.06,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: DGColors.textMutedDark,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: DGColors.borderBlue,
        thickness: 1,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: DGColors.surfaceDarker,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: DGColors.borderBlue),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: DGColors.sidebarBgDark,
      ),
    );
  }

  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: 'sans-serif',
      colorScheme: ColorScheme.light(
        primary: DGColors.accent,
        secondary: DGColors.blue,
        surface: DGColors.surfaceLight,
        error: DGColors.error,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: DGColors.textLight,
      ),
      scaffoldBackgroundColor: DGColors.surfaceLight,
      appBarTheme: const AppBarTheme(
        backgroundColor: DGColors.surfaceLight,
        foregroundColor: DGColors.textLight,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: DGColors.surfaceLightCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: DGColors.borderLightBlue, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withAlpha(204),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: DGColors.borderLightBlue),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: DGColors.borderLightBlue),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: DGColors.blue, width: 1.5),
        ),
        hintStyle: const TextStyle(color: DGColors.textMutedLight, fontSize: 13),
        labelStyle: const TextStyle(color: DGColors.textMutedLight),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: DGColors.accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.06,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(color: DGColors.borderLightBlue),
      dialogTheme: DialogThemeData(
        backgroundColor: DGColors.surfaceLight,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: DGColors.borderLightBlue),
        ),
      ),
    );
  }
}
