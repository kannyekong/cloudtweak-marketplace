import { Show, createSignal } from 'solid-js';

import { FiCheck, FiTool } from 'solid-icons/fi';

interface TechnicalSupportFormState {
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
	company_name: string;
	job_title: string;
	support_type: string;
	product_or_service: string;
	issue_summary: string;
	requirements: string;
	preferred_date: string;
	location: string;
}

interface TechnicalSupportApiResponse {
	success: boolean;
	message?: string;
	request_number?: string;
}

/* Renders the storefront form used to submit technical-support requests. */
export default function TechnicalSupportForm() {
	const [form, setForm] = createSignal<TechnicalSupportFormState>({
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		company_name: '',
		job_title: '',
		support_type: '',
		product_or_service: '',
		issue_summary: '',
		requirements: '',
		preferred_date: '',
		location: '',
	});

	const [submitting, setSubmitting] = createSignal(false);

	const [error, setError] = createSignal('');

	const [success, setSuccess] = createSignal<TechnicalSupportApiResponse | null>(null);

	/* Updates one form field while clearing stale validation feedback. */
	function updateField<K extends keyof TechnicalSupportFormState>(
		field: K,
		value: TechnicalSupportFormState[K],
	) {
		setForm((current) => ({
			...current,
			[field]: value,
		}));

		setError('');
	}

	/* Validates and submits the support request to the storefront API. */
	async function submitSupportRequest(event: SubmitEvent) {
		event.preventDefault();

		const currentForm = form();

		if (!currentForm.first_name.trim()) {
			setError('Enter your first name.');
			return;
		}

		if (!currentForm.last_name.trim()) {
			setError('Enter your last name.');
			return;
		}

		if (!currentForm.email.trim()) {
			setError('Enter your email address.');
			return;
		}

		if (!currentForm.phone.trim()) {
			setError('Enter your phone number.');
			return;
		}

		if (!currentForm.support_type) {
			setError('Select the type of support you need.');
			return;
		}

		if (currentForm.issue_summary.trim().length < 10) {
			setError('Tell us briefly what support you need.');
			return;
		}

		try {
			setSubmitting(true);
			setError('');

			const response = await fetch('/api/support/technical', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					...currentForm,

					company_name: currentForm.company_name.trim() || null,

					job_title: currentForm.job_title.trim() || null,

					product_or_service: currentForm.product_or_service.trim() || null,

					requirements: currentForm.requirements.trim() || null,

					preferred_date: currentForm.preferred_date || null,

					location: currentForm.location.trim() || null,

					source: 'technical_support_page',
				}),
			});

			const responseText = await response.text();

			let result: TechnicalSupportApiResponse;

			try {
				result = JSON.parse(responseText) as TechnicalSupportApiResponse;
			} catch {
				throw new Error(
					`Technical support endpoint returned an unexpected response (${response.status}).`,
				);
			}

			if (!response.ok || !result.success) {
				throw new Error(result.message ?? 'Unable to submit your support request.');
			}

			setSuccess(result);
		} catch (submitError) {
			console.error('Unable to submit technical support request:', submitError);

			setError(
				submitError instanceof Error
					? submitError.message
					: 'Unable to submit your support request.',
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div class="min-w-0">
			<Show
				when={!success()}
				fallback={
					<div class="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
						<div class="flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white">
							<FiCheck class="size-5" />
						</div>

						<h2 class="mt-5 text-xl font-black text-slate-950">Support request received</h2>

						<p class="mt-3 text-sm leading-7 text-slate-600">
							Our technical team will review your request and contact you with the next steps.
						</p>

						<Show when={success()?.request_number}>
							<div class="mt-5 rounded-xl border border-emerald-200 bg-white px-4 py-3">
								<p class="text-xs font-semibold text-slate-500">Request reference</p>

								<p class="mt-1 font-bold text-slate-950">{success()?.request_number}</p>
							</div>
						</Show>
					</div>
				}
			>
				<form
					onSubmit={submitSupportRequest}
					class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
				>
					<section class="p-5 sm:p-6">
						<div class="flex items-center gap-3">
							<div>
								<p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Step 1</p>

								<h2 class="text-lg font-black text-slate-950">Contact details</h2>
							</div>
						</div>

						<div class="mt-5 grid gap-4 sm:grid-cols-2">
							<label class="block">
								<span class="text-xs font-semibold text-slate-700">First name</span>

								<input
									type="text"
									value={form().first_name}
									onInput={(event) => updateField('first_name', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Last name</span>

								<input
									type="text"
									value={form().last_name}
									onInput={(event) => updateField('last_name', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Email</span>

								<input
									type="email"
									value={form().email}
									onInput={(event) => updateField('email', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Phone</span>

								<input
									type="tel"
									value={form().phone}
									onInput={(event) => updateField('phone', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Organization</span>

								<input
									type="text"
									value={form().company_name}
									onInput={(event) => updateField('company_name', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Job title</span>

								<input
									type="text"
									value={form().job_title}
									onInput={(event) => updateField('job_title', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>
						</div>
					</section>

					<section class="border-t border-slate-200 p-5 sm:p-6">
						<p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Step 2</p>

						<h2 class="mt-1 text-lg font-black text-slate-950">Support requirements</h2>

						<div class="mt-5 grid gap-4 sm:grid-cols-2">
							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Support type</span>

								<select
									value={form().support_type}
									onChange={(event) => updateField('support_type', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								>
									<option value="">Select support type</option>
									<option value="installation">Installation</option>
									<option value="configuration">Configuration</option>
									<option value="deployment">Deployment</option>
									<option value="migration">Migration</option>
									<option value="microsoft_365">Microsoft 365</option>
									<option value="cloud">Cloud</option>
									<option value="network">Network</option>
									<option value="device_setup">Device Setup</option>
									<option value="other">Other</option>
								</select>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Product or service</span>

								<input
									type="text"
									value={form().product_or_service}
									onInput={(event) => updateField('product_or_service', event.currentTarget.value)}
									placeholder="e.g. Microsoft 365, Dell laptops"
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>
						</div>

						<label class="mt-4 block">
							<span class="text-xs font-semibold text-slate-700">What support do you need?</span>

							<textarea
								rows={3}
								value={form().issue_summary}
								onInput={(event) => updateField('issue_summary', event.currentTarget.value)}
								placeholder="Briefly describe what you need help with."
								class="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
							/>
						</label>

						<label class="mt-4 block">
							<span class="text-xs font-semibold text-slate-700">Additional requirements</span>

							<textarea
								rows={4}
								value={form().requirements}
								onInput={(event) => updateField('requirements', event.currentTarget.value)}
								placeholder="Environment details, scope, number of devices/users or other requirements."
								class="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
							/>
						</label>
					</section>

					<section class="border-t border-slate-200 p-5 sm:p-6">
						<p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Step 3</p>

						<h2 class="mt-1 text-lg font-black text-slate-950">Scheduling</h2>

						<div class="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
							<label class="block min-w-0">
								<span class="text-xs font-semibold text-slate-700">Preferred date</span>

								<input
									type="date"
									value={form().preferred_date}
									onInput={(event) => updateField('preferred_date', event.currentTarget.value)}
									class="mt-2 block min-h-12 w-full min-w-0 max-w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Location</span>

								<input
									type="text"
									value={form().location}
									onInput={(event) => updateField('location', event.currentTarget.value)}
									placeholder="Lagos, Nigeria or Remote"
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>
						</div>
					</section>

					<Show when={error()}>
						<div class="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 sm:mx-6">
							{error()}
						</div>
					</Show>

					<div class="border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
						<button
							type="submit"
							disabled={submitting()}
							class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{submitting() ? 'Submitting request...' : 'Submit Support Request'}
						</button>
					</div>
				</form>
			</Show>
		</div>
	);
}
