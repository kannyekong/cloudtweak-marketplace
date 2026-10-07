export type CookieConsent = {
	essential: true;
	analytics: boolean;
	marketing: boolean;
	updatedAt: string;
};

export const COOKIE_CONSENT_STORAGE_KEY = 'tweakmart_cookie_consent';

/*
 * Reads the visitor's existing cookie preferences from localStorage.
 * Invalid or outdated values are treated as no consent.
 */
export function getCookieConsent(): CookieConsent | null {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const storedConsent = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);

		if (!storedConsent) {
			return null;
		}

		const parsedConsent = JSON.parse(storedConsent) as Partial<CookieConsent>;

		if (
			parsedConsent.essential !== true ||
			typeof parsedConsent.analytics !== 'boolean' ||
			typeof parsedConsent.marketing !== 'boolean'
		) {
			return null;
		}

		return {
			essential: true,
			analytics: parsedConsent.analytics,
			marketing: parsedConsent.marketing,
			updatedAt:
				typeof parsedConsent.updatedAt === 'string'
					? parsedConsent.updatedAt
					: new Date().toISOString(),
		};
	} catch {
		return null;
	}
}

/*
 * Persists the visitor's selected cookie preferences and announces
 * the change so optional integrations can react immediately.
 */
export function saveCookieConsent(preferences: Pick<CookieConsent, 'analytics' | 'marketing'>) {
	if (typeof window === 'undefined') {
		return;
	}

	const consent: CookieConsent = {
		essential: true,
		analytics: preferences.analytics,
		marketing: preferences.marketing,
		updatedAt: new Date().toISOString(),
	};

	window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));

	window.dispatchEvent(
		new CustomEvent('tweakmart:cookie-consent-changed', {
			detail: consent,
		}),
	);
}
