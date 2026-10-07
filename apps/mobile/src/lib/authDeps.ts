// The one native-importing glue layer for the auth flows: builds the injected
// deps objects that authFlows.ts consumes. Kept free of logic so everything
// testable lives in authFlows.ts (this file is covered by device testing).
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import type { AppleDeps, GoogleDeps } from './authFlows'
import { describeAuthError, recordAuthFailure } from './authDiagnostics'
import { supabase } from './supabase'

function nativeErrorCode(error: unknown): string | null {
  return isErrorWithCode(error) ? error.code : null
}

function isGoogleCancellation(error: unknown): boolean {
  const code = nativeErrorCode(error)
  return code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS
}

function sharedDiagnostics() {
  return {
    describeError: describeAuthError,
    logFailure: recordAuthFailure,
  }
}

export function makeAppleDeps(): AppleDeps {
  return {
    supabase,
    signInAsync: (hashedNonce) =>
      AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      }),
    sha256: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
    randomUUID: () => Crypto.randomUUID(),
    isCancelError: (error) =>
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED',
    ...sharedDiagnostics(),
  }
}

export function makeGoogleDeps(): GoogleDeps {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  return {
    supabase,
    configure: () => GoogleSignin.configure({ webClientId, iosClientId }),
    signIn: async () => {
      const result = await GoogleSignin.signIn()
      // v13+ returns { type: 'success' | 'cancelled', data }; treat a
      // user-cancelled response like the coded cancel error.
      if (result.type === 'cancelled') {
        const cancel = new Error('Sign-in cancelled') as Error & { code: string }
        cancel.code = statusCodes.SIGN_IN_CANCELLED
        throw cancel
      }
      return { idToken: result.data?.idToken ?? null }
    },
    isCancelError: isGoogleCancellation,
    isPlayServicesError: (error) =>
      nativeErrorCode(error) === statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
    // DEVELOPER_ERROR is not part of the public `statusCodes`; the Android
    // native module rejects with the raw CommonStatusCodes.DEVELOPER_ERROR
    // value ("10"). It means the app's package + signing SHA-1 aren't registered
    // against an Android OAuth client in webClientId's Google Cloud project.
    isConfigError: (error) => nativeErrorCode(error) === '10',
    // The raw code/status the mapper is about to replace with friendly copy.
    // Logged here, at the one layer that still holds the native error object.
    ...sharedDiagnostics(),
  }
}
