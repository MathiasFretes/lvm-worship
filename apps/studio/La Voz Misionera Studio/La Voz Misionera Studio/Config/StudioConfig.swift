//
//  StudioConfig.swift
//  La Voz Misionera Studio
//
//  Supabase project URL + anon key for Studio.
//
//  These are the same public-safe client credentials apps/mobile and apps/web use
//  (EXPO_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL and the matching anon keys) —
//  RLS does the real enforcement. Both apps keep them in gitignored .env files,
//  so Studio follows suit: the committed constants below are empty placeholders.
//
//  Fill them in one of three ways, checked in this order:
//
//    1. Scheme environment variables — Product ▸ Scheme ▸ Edit Scheme ▸ Run ▸
//       Arguments ▸ Environment Variables: SUPABASE_URL and SUPABASE_ANON_KEY.
//    2. Info.plist keys of the same names (e.g. injected from an xcconfig).
//    3. The fallback constants at the bottom of this file — quickest, but do not
//       commit real values (`git update-index --skip-worktree` on this file keeps
//       local edits out of `git status`).
//
//  Missing config is surfaced as a readable screen, never a crash — the same
//  reasoning as apps/mobile's supabaseConfigError: a hard failure at startup
//  looks like an unexplained crash rather than a setup problem.
//

import Foundation

struct StudioConfig {
    let supabaseURL: URL
    let supabaseAnonKey: String
    /// Base URL of the web app's Pages Functions, which render PDF/JPG exports
    /// (`EXPO_PUBLIC_API_BASE_URL` on mobile).
    ///
    /// Optional on purpose: everything except Export works without it, so a missing
    /// value disables that one surface instead of gating the whole app behind a
    /// second piece of setup.
    let apiBaseURL: URL?

    private enum Key: String {
        case supabaseURL = "SUPABASE_URL"
        case supabaseAnonKey = "SUPABASE_ANON_KEY"
        case apiBaseURL = "API_BASE_URL"
    }

    private struct Values {
        let supabaseURL: String
        let supabaseAnonKey: String
        let apiBaseURL: String

        init(environment: [String: String], info: [String: Any]) {
            supabaseURL = Self.resolve(
                .supabaseURL,
                environment: environment,
                info: info,
                fallback: StudioConfig.fallbackSupabaseURL
            )
            supabaseAnonKey = Self.resolve(
                .supabaseAnonKey,
                environment: environment,
                info: info,
                fallback: StudioConfig.fallbackSupabaseAnonKey
            )
            apiBaseURL = Self.resolve(
                .apiBaseURL,
                environment: environment,
                info: info,
                fallback: StudioConfig.fallbackAPIBaseURL
            )
        }

        var missingRequiredKeys: [String] {
            [
                supabaseURL.isEmpty ? Key.supabaseURL.rawValue : nil,
                supabaseAnonKey.isEmpty ? Key.supabaseAnonKey.rawValue : nil,
            ].compactMap { $0 }
        }

        private static func resolve(
            _ key: Key,
            environment: [String: String],
            info: [String: Any],
            fallback: String
        ) -> String {
            let candidates = [
                environment[key.rawValue],
                info[key.rawValue] as? String,
                fallback,
            ]
            return candidates
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty }) ?? ""
        }
    }

    enum ConfigError: LocalizedError {
        case missingValues([String])
        case invalidURL(String)

        var errorDescription: String? {
            switch self {
            case .missingValues(let names):
                return """
                Missing Supabase configuration: \(names.joined(separator: ", ")).

                Set them as scheme environment variables (Product ▸ Scheme ▸ Edit \
                Scheme ▸ Run ▸ Arguments), as Info.plist keys, or in the fallback \
                constants in Config/StudioConfig.swift.

                Use the same values as apps/mobile/.env \
                (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). The \
                anon key is the public client key — never the service-role key.
                """
            case .invalidURL(let value):
                return "SUPABASE_URL is not a valid URL: \(value)"
            }
        }
    }

    static func resolve() -> Result<StudioConfig, ConfigError> {
        let values = Values(
            environment: ProcessInfo.processInfo.environment,
            info: Bundle.main.infoDictionary ?? [:]
        )
        if !values.missingRequiredKeys.isEmpty {
            return .failure(.missingValues(values.missingRequiredKeys))
        }

        guard let supabaseURL = absoluteURL(from: values.supabaseURL) else {
            return .failure(.invalidURL(values.supabaseURL))
        }

        return .success(
            StudioConfig(
                supabaseURL: supabaseURL,
                supabaseAnonKey: values.supabaseAnonKey,
                apiBaseURL: optionalAPIURL(from: values.apiBaseURL)
            )
        )
    }

    private static func absoluteURL(from value: String) -> URL? {
        guard let url = URL(string: value), url.scheme != nil, url.host != nil else {
            return nil
        }
        return url
    }

    private static func optionalAPIURL(from value: String) -> URL? {
        // Keep mobile's one-trailing-slash normalization and its fail-open export
        // contract: malformed optional configuration disables Export only.
        let normalized = value.hasSuffix("/") ? String(value.dropLast()) : value
        return normalized.isEmpty ? nil : URL(string: normalized)
    }

    // MARK: - Local fallbacks (do not commit real values)

    private static let fallbackSupabaseURL = ""
    private static let fallbackSupabaseAnonKey = ""
    /// e.g. "https://www.lavozmisionera.com" — the canonical origin, not a
    /// redirecting one (mobile's apiError has a whole branch about that).
    private static let fallbackAPIBaseURL = ""
}
