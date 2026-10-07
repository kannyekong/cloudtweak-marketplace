import { For, Show, createMemo, createSignal } from 'solid-js';
import { FiBox, FiCalendar, FiCheck, FiMinus, FiPlus, FiTrash2 } from 'solid-icons/fi';

interface BulkOrderItem {
	id: string;
	product_name: string;
	quantity: number;
	specifications: string;
}

interface BulkOrderFormState {
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
	company_name: string;
	job_title: string;
	budget_range: string;
	required_by_date: string;
	delivery_address: string;
	delivery_city: string;
	delivery_state: string;
	delivery_country: string;
	additional_requirements: string;
}

interface BulkOrderApiResponse {
	success: boolean;
	message?: string;
	quote_number?: string;
}

/* Creates a unique client-side identifier for each bulk-order line item. */
function createItemId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* Creates an empty product line for the bulk-order form. */
function createEmptyItem(): BulkOrderItem {
	return {
		id: createItemId(),
		product_name: '',
		quantity: 1,
		specifications: '',
	};
}

/* Renders the TweakMart bulk-order request form. */
export default function BulkOrderForm() {
	const [form, setForm] = createSignal<BulkOrderFormState>({
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		company_name: '',
		job_title: '',
		budget_range: '',
		required_by_date: '',
		delivery_address: '',
		delivery_city: '',
		delivery_state: '',
		delivery_country: 'Nigeria',
		additional_requirements: '',
	});

	const [items, setItems] = createSignal<BulkOrderItem[]>([createEmptyItem()]);

	const [submitting, setSubmitting] = createSignal(false);
	const [error, setError] = createSignal('');
	const [success, setSuccess] = createSignal<BulkOrderApiResponse | null>(null);

	/* Calculates the total quantity requested across all product lines. */
	const totalQuantity = createMemo(() =>
		items().reduce((total, item) => total + Math.max(0, item.quantity), 0),
	);

	/* Updates one top-level bulk-order field. */
	function updateField<K extends keyof BulkOrderFormState>(field: K, value: BulkOrderFormState[K]) {
		setForm((current) => ({
			...current,
			[field]: value,
		}));

		setError('');
	}

	/* Updates one field belonging to a specific bulk-order product line. */
	function updateItem<K extends keyof BulkOrderItem>(
		itemId: string,
		field: K,
		value: BulkOrderItem[K],
	) {
		setItems((current) =>
			current.map((item) =>
				item.id === itemId
					? {
							...item,
							[field]: value,
						}
					: item,
			),
		);

		setError('');
	}

	/* Adds another product requirement while respecting the quote API's 25-item limit. */
	function addItem() {
		if (items().length >= 25) {
			setError('A bulk order request can contain up to 25 items.');
			return;
		}

		setItems((current) => [...current, createEmptyItem()]);
		setError('');
	}

	/* Removes one product requirement while always preserving at least one line. */
	function removeItem(itemId: string) {
		setItems((current) => {
			if (current.length <= 1) {
				return current;
			}

			return current.filter((item) => item.id !== itemId);
		});
	}

	/* Increases or decreases the quantity of one bulk-order line. */
	function changeQuantity(itemId: string, change: number) {
		const item = items().find((current) => current.id === itemId);

		if (!item) {
			return;
		}

		updateItem(itemId, 'quantity', Math.max(1, item.quantity + change));
	}

	/* Validates and submits the bulk-order request to the existing quotation backend. */
	async function submitBulkOrder(event: SubmitEvent) {
		event.preventDefault();

		setError('');
		setSuccess(null);

		const currentForm = form();

		const validItems = items().filter((item) => item.product_name.trim() && item.quantity > 0);

		if (validItems.length === 0) {
			setError('Add at least one product to your bulk order.');
			return;
		}

		/* Validates the contact, organization and delivery information required by the existing quote-request API. */
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

		if (!currentForm.company_name.trim()) {
			setError('Enter your organization name.');
			return;
		}

		if (!currentForm.delivery_address.trim()) {
			setError('Enter the delivery address.');
			return;
		}

		if (!currentForm.delivery_city.trim()) {
			setError('Enter the delivery city.');
			return;
		}

		if (!currentForm.delivery_state.trim()) {
			setError('Enter the delivery state.');
			return;
		}

		if (!currentForm.delivery_country.trim()) {
			setError('Enter the delivery country.');
			return;
		}

		try {
			setSubmitting(true);

			/* Builds the request using the existing shared TweakMart quote API contract. */
			const payload = {
				request_type: 'bulk_order' as const,

				first_name: currentForm.first_name.trim(),
				last_name: currentForm.last_name.trim(),
				email: currentForm.email.trim(),
				phone: currentForm.phone.trim(),

				company_name: currentForm.company_name.trim(),
				job_title: currentForm.job_title.trim() || null,
				budget_range: currentForm.budget_range || null,

				required_by_date: currentForm.required_by_date || null,

				delivery_address: currentForm.delivery_address.trim(),
				delivery_city: currentForm.delivery_city.trim(),
				delivery_state: currentForm.delivery_state.trim(),
				delivery_country: currentForm.delivery_country.trim() || 'Nigeria',

				additional_requirements: currentForm.additional_requirements.trim() || null,

				source: 'tweakmart_bulk_orders',

				items: validItems.map((item) => ({
					product_id: null,
					variant_id: null,
					product_name: item.product_name.trim(),
					sku: null,
					quantity: item.quantity,
					specifications: item.specifications.trim() || null,
				})),
			};

			/* Submits the validated bulk-order request through the shared quote endpoint. */
			const response = await fetch('/api/quotes/request', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			const responseText = await response.text();

			let result: BulkOrderApiResponse;

			try {
				result = JSON.parse(responseText) as BulkOrderApiResponse;
			} catch {
				throw new Error(
					`Bulk order endpoint returned an unexpected response (${response.status}).`,
				);
			}

			if (!response.ok || !result.success) {
				throw new Error(result.message ?? 'Unable to submit your bulk order request.');
			}

			setSuccess(result);
		} catch (submitError) {
			console.error('Unable to submit TweakMart bulk order:', submitError);

			setError(
				submitError instanceof Error
					? submitError.message
					: 'Unable to submit your bulk order request.',
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

						<h2 class="mt-5 text-xl font-black text-slate-950">Bulk order request received</h2>

						<p class="mt-3 text-sm leading-7 text-slate-600">
							Your requirements have been submitted to the CloudTweak team for review.
						</p>

						<Show when={success()?.quote_number}>
							<div class="mt-5 rounded-xl border border-emerald-200 bg-white px-4 py-3">
								<p class="text-xs font-semibold text-slate-500">Request reference</p>

								<p class="mt-1 font-bold text-slate-950">{success()?.quote_number}</p>
							</div>
						</Show>
					</div>
				}
			>
				<form
					onSubmit={submitBulkOrder}
					class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
				>
					<section class="p-5 sm:p-6">
						<div class="flex items-center gap-3">
							<div class="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
								<FiBox class="size-4" />
							</div>

							<div>
								<p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Step 1</p>

								<h2 class="text-lg font-black text-slate-950">Products & quantities</h2>
							</div>
						</div>

						<div class="mt-6 space-y-4">
							<For each={items()}>
								{(item, index) => (
									<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
										<div class="flex items-center justify-between gap-4">
											<p class="text-xs font-bold text-slate-700">Item {index() + 1}</p>

											<Show when={items().length > 1}>
												<button
													type="button"
													onClick={() => removeItem(item.id)}
													class="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
													aria-label={`Remove item ${index() + 1}`}
												>
													<FiTrash2 class="size-4" />
												</button>
											</Show>
										</div>

										<div class="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
											<label class="block min-w-0">
												<span class="text-xs font-semibold text-slate-700">
													Product / Technology
												</span>

												<input
													type="text"
													value={item.product_name}
													onInput={(event) =>
														updateItem(item.id, 'product_name', event.currentTarget.value)
													}
													placeholder="e.g. Dell Latitude 5450"
													class="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
												/>
											</label>

											<div>
												<span class="text-xs font-semibold text-slate-700">Quantity</span>

												<div class="mt-2 flex min-h-12 items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
													<button
														type="button"
														onClick={() => changeQuantity(item.id, -1)}
														class="flex size-11 items-center justify-center text-slate-500 hover:bg-slate-50"
													>
														<FiMinus class="size-4" />
													</button>

													<input
														type="number"
														min="1"
														value={item.quantity}
														onInput={(event) =>
															updateItem(
																item.id,
																'quantity',
																Math.max(1, Number(event.currentTarget.value) || 1),
															)
														}
														class="w-16 border-x border-slate-200 py-2 text-center text-sm font-bold text-slate-950 outline-none"
													/>

													<button
														type="button"
														onClick={() => changeQuantity(item.id, 1)}
														class="flex size-11 items-center justify-center text-slate-500 hover:bg-slate-50"
													>
														<FiPlus class="size-4" />
													</button>
												</div>
											</div>
										</div>

										<label class="mt-4 block">
											<span class="text-xs font-semibold text-slate-700">
												Specifications
												<span class="ml-1 font-normal text-slate-400">Optional</span>
											</span>

											<input
												type="text"
												value={item.specifications}
												onInput={(event) =>
													updateItem(item.id, 'specifications', event.currentTarget.value)
												}
												placeholder="RAM, storage, colour, licensing or other requirements"
												class="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
											/>
										</label>
									</div>
								)}
							</For>
						</div>

						<button
							type="button"
							onClick={addItem}
							disabled={items().length >= 25}
							class="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<FiPlus class="size-4" />
							{items().length >= 25 ? 'Maximum 25 items' : 'Add another item'}
						</button>

						<p class="mt-4 text-xs text-slate-500">
							Total quantity requested:{' '}
							<span class="font-bold text-slate-900">{totalQuantity()}</span>
						</p>
					</section>

					<section class="border-t border-slate-200 p-5 sm:p-6">
						<p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Step 2</p>

						<h2 class="mt-1 text-lg font-black text-slate-950">Contact & organization</h2>

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
								<span class="text-xs font-semibold text-slate-700">Business email</span>

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
									placeholder="Company or organization name"
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">
									Job title
									<span class="ml-1 font-normal text-slate-400">Optional</span>
								</span>

								<input
									type="text"
									value={form().job_title}
									onInput={(event) => updateField('job_title', event.currentTarget.value)}
									placeholder="e.g. IT Manager"
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>
						</div>
					</section>

					<section class="border-t border-slate-200 p-5 sm:p-6">
						<p class="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Step 3</p>

						<h2 class="mt-1 text-lg font-black text-slate-950">Delivery & requirements</h2>

						<div class="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
							<label class="block sm:col-span-2">
								<span class="text-xs font-semibold text-slate-700">Delivery address</span>

								<input
									type="text"
									value={form().delivery_address}
									onInput={(event) => updateField('delivery_address', event.currentTarget.value)}
									placeholder="Street or office address"
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">City</span>

								<input
									type="text"
									value={form().delivery_city}
									onInput={(event) => updateField('delivery_city', event.currentTarget.value)}
									placeholder="Lagos"
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">State</span>

								<input
									type="text"
									value={form().delivery_state}
									onInput={(event) => updateField('delivery_state', event.currentTarget.value)}
									placeholder="Lagos"
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block">
								<span class="text-xs font-semibold text-slate-700">Country</span>

								<input
									type="text"
									value={form().delivery_country}
									onInput={(event) => updateField('delivery_country', event.currentTarget.value)}
									class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
								/>
							</label>

							<label class="block min-w-0">
								<span class="text-xs font-semibold text-slate-700">
									Required by
									<span class="ml-1 font-normal text-slate-400">Optional</span>
								</span>

								<div class="relative mt-2 min-w-0">
									<input
										type="date"
										value={form().required_by_date}
										onInput={(event) => updateField('required_by_date', event.currentTarget.value)}
										class="block min-h-12 w-full min-w-0 max-w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-4 pr-11 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
									/>

									<FiCalendar
										aria-hidden="true"
										class="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
									/>
								</div>
							</label>
						</div>

						<label class="mt-4 block">
							<span class="text-xs font-semibold text-slate-700">
								Additional requirements
								<span class="ml-1 font-normal text-slate-400">Optional</span>
							</span>

							<textarea
								rows={4}
								value={form().additional_requirements}
								onInput={(event) =>
									updateField('additional_requirements', event.currentTarget.value)
								}
								placeholder="Delivery instructions, deployment requirements, preferred brands or anything else we should know."
								class="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
							/>
						</label>
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
							{submitting() ? 'Submitting request...' : 'Submit Bulk Order Request'}
						</button>

						<p class="mt-3 text-center text-[11px] leading-5 text-slate-500">
							Submitting this request does not place an order or charge you. Our team will review
							your requirements and respond with the next steps.
						</p>
					</div>
				</form>
			</Show>
		</div>
	);
}
