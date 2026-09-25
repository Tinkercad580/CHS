import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Native configuration on top of app.json.
 *
 * Store identifiers — register exactly these in the Firebase console (Android
 * package name, Apple bundle ID). Once an app is published they can't change,
 * so override them only before the first release.
 *
 * Firebase is switched on per platform by the presence of its client config
 * file, downloaded from the Firebase console into this folder:
 *   google-services.json       (Android)
 *   GoogleService-Info.plist   (iOS)
 * Without them the app still builds and runs; it just can't receive push.
 * These files are public client identifiers, but they're per-environment, so
 * they're kept out of git (see the repo .gitignore) and written by CI.
 */
const ANDROID_PACKAGE = process.env.CHS_GATE_ANDROID_PACKAGE ?? "in.sahaj.gate";
const IOS_BUNDLE_ID = process.env.CHS_GATE_IOS_BUNDLE_ID ?? "in.sahaj.gate";

const androidFirebase = existsSync(resolve(__dirname, "google-services.json"));
const iosFirebase = existsSync(resolve(__dirname, "GoogleService-Info.plist"));

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Sahaj",
  slug: config.slug ?? "sahaj-gate-app",
  ios: {
    ...config.ios,
    bundleIdentifier: IOS_BUNDLE_ID,
    ...(iosFirebase ? { googleServicesFile: "./GoogleService-Info.plist" } : {}),
    infoPlist: { ...config.ios?.infoPlist, UIBackgroundModes: ["remote-notification"] },
  },
  android: {
    ...config.android,
    package: ANDROID_PACKAGE,
    ...(androidFirebase ? { googleServicesFile: "./google-services.json" } : {}),
    // Android 13+ asks before showing notifications.
    permissions: [...(config.android?.permissions ?? []), "android.permission.POST_NOTIFICATIONS"],
  },
  plugins: [
    ...(config.plugins ?? []),
    ["expo-notifications", { color: "#0E6B5C", defaultChannel: "default" }],
    [
      "expo-build-properties",
      {
        android: { minSdkVersion: 24 },
        // React Native Firebase's iOS pods need static frameworks.
        ...(iosFirebase ? { ios: { useFrameworks: "static" } } : {}),
      },
    ],
    ...(androidFirebase || iosFirebase ? ["@react-native-firebase/app", "@react-native-firebase/messaging"] : []),
  ],
  extra: {
    ...config.extra,
    pushEnabled: androidFirebase || iosFirebase,
    apiOrigin: process.env.EXPO_PUBLIC_API_ORIGIN,
  },
});
