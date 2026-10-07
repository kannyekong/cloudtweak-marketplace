import { createSignal, onMount, Show } from 'solid-js';
import { FiCheck, FiChevronLeft, FiSettings, FiShield, FiX } from 'solid-icons/fi';

import { getCookieConsent, saveCookieConsent } from '../../lib/tweakmart/cookie-consent';

/*
 * Displays TweakMart's cookie consent manager and persists the
 * visitor's optional-cookie choices in localStorage.
 */
export default function CookieConsent() {
	const [visible, setVisible] = createSignal(false);
	const [showPreferences, setShowPreferences] = createSignal(false);

	const [analytics, setAnalytics] = createSignal(false);
	const [marketing, setMarketing] = createSignal(false);

	/*
	 * Loads existing consent and listens for requests from elsewhere
	 * on the storefront to reopen the cookie preference manager.
	 */
	onMount(() => {
		const existingConsent = getCookieConsent();

		if (!existingConsent) {
			setVisible(true);
		} else {
			setAnalytics(existingConsent.analytics);
			setMarketing(existingConsent.marketing);
		}

		const openPreferences = () => {
			const currentConsent = getCookieConsent();

			if (currentConsent) {
				setAnalytics(currentConsent.analytics);
				setMarketing(currentConsent.marketing);
			}

			setShowPreferences(true);
			setVisible(true);
		};

		window.addEventListener('tweakmart:open-cookie-preferences', openPreferences);

		return () => {
			window.removeEventListener('tweakmart:open-cookie-preferences', openPreferences);
		};
	});

	/*
	 * Grants consent to all optional cookie categories.
	 */
	function acceptAll() {
		saveCookieConsent({
			analytics: true,
			marketing: true,
		});

		setAnalytics(true);
		setMarketing(true);
		setVisible(false);
		setShowPreferences(false);
	}

	/*
	 * Rejects all optional cookies while preserving essential
	 * storefront functionality.
	 */
	function rejectOptional() {
		saveCookieConsent({
			analytics: false,
			marketing: false,
		});

		setAnalytics(false);
		setMarketing(false);
		setVisible(false);
		setShowPreferences(false);
	}

	/*
	 * Persists the visitor's individually selected categories.
	 */
	function savePreferences() {
		saveCookieConsent({
			analytics: analytics(),
			marketing: marketing(),
		});

		setVisible(false);
		setShowPreferences(false);
	}

	return (
		<Show when={visible()}>
			<div class="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5">
				<div class="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-blue-800 bg-white shadow-2xl">
					<Show
						when={showPreferences()}
						fallback={
							<div class="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
								<div class="flex min-w-0 flex-1 gap-4">
									<div>
										<h2 class="font-bold text-slate-950">Your privacy matters</h2>

										<p class="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
											We use essential cookies to keep TweakMart working. With your permission, we
											may also use optional cookies to understand how the storefront is used and
											improve your experience.
										</p>

										<a
											href="/cookies"
											class="mt-2 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700"
										>
											Read our Cookie Policy
										</a>
									</div>
								</div>

								<div class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
									<button
										type="button"
										onClick={() => setShowPreferences(true)}
										class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									>
										<FiSettings size={16} />
										Preferences
									</button>

									<button
										type="button"
										onClick={rejectOptional}
										class="inline-flex h-10 items-center justify-center rounded-lg border border-red-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									>
										Reject optional
									</button>

									<button
										type="button"
										onClick={acceptAll}
										class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-green-500 px-5 text-sm font-bold text-white transition hover:bg-blue-950"
									>
										<FiCheck size={16} />
										Accept optional
									</button>
								</div>
							</div>
						}
					>
						<div class="p-5 sm:p-6">
							<div class="flex items-start justify-between gap-4">
								<div>
									<button
										type="button"
										onClick={() => setShowPreferences(false)}
										class="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900"
									>
										<FiChevronLeft size={16} />
										Back
									</button>

									<h2 class="text-lg font-bold text-slate-950">Cookie preferences</h2>

									<p class="mt-1 text-sm leading-6 text-slate-600">
										Choose which optional cookies TweakMart may use. Essential cookies cannot be
										disabled because they are required for core storefront functionality.
									</p>
								</div>

								<button
									type="button"
									onClick={() => setVisible(false)}
									class="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
									aria-label="Close cookie preferences"
								>
									<FiX size={18} />
								</button>
							</div>

							<div class="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
								<div class="flex items-center justify-between gap-5 p-4">
									<div>
										<p class="text-sm font-bold text-slate-900">Essential</p>
										<p class="mt-1 text-xs leading-5 text-slate-500">
											Required for core functionality, security and your shopping experience.
										</p>
									</div>

									<span class="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
										Always active
									</span>
								</div>

								<label class="flex cursor-pointer items-center justify-between gap-5 p-4">
									<div>
										<p class="text-sm font-bold text-slate-900">Analytics</p>
										<p class="mt-1 text-xs leading-5 text-slate-500">
											Helps us understand storefront usage and improve TweakMart.
										</p>
									</div>

									<input
										type="checkbox"
										checked={analytics()}
										onChange={(event) => setAnalytics(event.currentTarget.checked)}
										class="size-5 accent-blue-600"
									/>
								</label>

								<label class="flex cursor-pointer items-center justify-between gap-5 p-4">
									<div>
										<p class="text-sm font-bold text-slate-900">Marketing</p>
										<p class="mt-1 text-xs leading-5 text-slate-500">
											Allows optional advertising and marketing measurement technologies.
										</p>
									</div>

									<input
										type="checkbox"
										checked={marketing()}
										onChange={(event) => setMarketing(event.currentTarget.checked)}
										class="size-5 accent-blue-600"
									/>
								</label>
							</div>

							<div class="mt-5 flex flex-wrap justify-end gap-2">
								<button
									type="button"
									onClick={rejectOptional}
									class="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
								>
									Reject optional
								</button>

								<button
									type="button"
									onClick={savePreferences}
									class="h-10 rounded-lg bg-[#000033] px-5 text-sm font-bold text-white transition hover:bg-blue-950"
								>
									Save preferences
								</button>
							</div>
						</div>
					</Show>
				</div>
			</div>
		</Show>
	);
}
