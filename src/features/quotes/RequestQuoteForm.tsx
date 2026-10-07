import { For, Show, createSignal } from 'solid-js';
import { FiCalendar, FiCheckCircle, FiLoader, FiMinus, FiPlus, FiSend, FiTrash2 } from 'solid-icons/fi';

type QuoteItem = {
	product_name: string;
	quantity: number;
	specifications: string;
};

type QuoteFormState = {
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
	additional_requirements: string;
};

type QuoteApiResponse = {
	success?: boolean;
	quote_number?: string;
	message?: string;
};

/* Creates a fresh product row whenever the customer adds another requested item. */
function createEmptyItem(): QuoteItem {
	return {
		product_name: '',
		quantity: 1,
		specifications: '',
	};
}

/* Creates the initial state for all customer, business and delivery fields. */
function createInitialFormState(): QuoteFormState {
	return {
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
		additional_requirements: '',
	};
}

/* Renders and manages the complete interactive TweakMart quote request form. */
export default function RequestQuoteForm() {
	const [form, setForm] = createSignal<QuoteFormState>(createInitialFormState());
	const [items, setItems] = createSignal<QuoteItem[]>([createEmptyItem()]);
	const [submitting, setSubmitting] = createSignal(false);
	const [errorMessage, setErrorMessage] = createSignal('');
	const [quoteNumber, setQuoteNumber] = createSignal('');

	/* Updates one customer, business or delivery field while preserving the remaining form state. */
	function updateField<K extends keyof QuoteFormState>(field: K, value: QuoteFormState[K]) {
		setForm((current) => ({
			...current,
			[field]: value,
		}));
	}

	/* Adds another product or technology row to the quote request. */
	function addItem() {
		setItems((current) => [...current, createEmptyItem()]);
	}

	/* Updates one property of a specific requested product. */
	function updateItem<K extends keyof QuoteItem>(index: number, field: K, value: QuoteItem[K]) {
		setItems((current) =>
			current.map((item, itemIndex) =>
				itemIndex === index
					? {
							...item,
							[field]: value,
						}
					: item,
			),
		);
	}

	/* Removes a product row while ensuring that the quote always contains at least one item. */
	function removeItem(index: number) {
		if (items().length <= 1) {
			return;
		}

		setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
	}

	/* Sends the complete quote request to the TweakMart server API. */
	async function submitQuote(event: SubmitEvent) {
		event.preventDefault();

		if (submitting()) {
			return;
		}

		setSubmitting(true);
		setErrorMessage('');

		try {
			const response = await fetch('/api/quotes/request', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					request_type: 'quote',
					...form(),
					delivery_country: 'Nigeria',
					source: 'request_quote_page',
					items: items().map((item) => ({
						product_name: item.product_name,
						quantity: item.quantity,
						specifications: item.specifications || null,
					})),
				}),
			});

			const result = (await response.json()) as QuoteApiResponse;

			if (!response.ok || !result.success || !result.quote_number) {
				throw new Error(result.message || 'We could not submit your quote request.');
			}

			setQuoteNumber(result.quote_number);
			setForm(createInitialFormState());
			setItems([createEmptyItem()]);

			window.scrollTo({
				top: 0,
				behavior: 'smooth',
			});
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'We could not submit your quote request. Please try again.',
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Show
			when={!quoteNumber()}
			fallback={
				<div class="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 lg:p-10">
					<div class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100">
						<FiCheckCircle class="size-7 text-emerald-700" />
					</div>

					<p class="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
						Request received
					</p>

					<h2 class="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
						Your quote request is on its way.
					</h2>

					<p class="mt-3 max-w-xl text-sm leading-7 text-slate-600">
						Our team will review your requirements and contact you using the details you provided.
						Keep your request reference handy if you need to contact us.
					</p>

					<div class="mt-6 max-w-md rounded-2xl border border-emerald-200 bg-white p-5">
						<p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Quote reference
						</p>

						<p class="mt-1 text-xl font-bold text-slate-950">{quoteNumber()}</p>
					</div>

					<div class="mt-6 flex flex-col gap-3 sm:flex-row">
						<a
							href="/products"
							class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
						>
							Continue shopping
						</a>

						<button
							type="button"
							onClick={() => setQuoteNumber('')}
							class="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
						>
							Request another quote
						</button>
					</div>
				</div>
			}
		>
			<form onSubmit={submitQuote}>
				<div class="grid gap-6 md:grid-cols-2 md:items-start">
					<div class="space-y-6">
						<section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<div>
								<p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Step 1</p>

								<h2 class="mt-2 text-xl font-bold text-slate-950">Your details</h2>

								<p class="mt-1 text-sm leading-6 text-slate-500">
									Tell us who we should contact about this request.
								</p>
							</div>

							<div class="mt-6 grid gap-5 sm:grid-cols-2">
								<label class="block">
									<span class="text-sm font-semibold text-slate-800">First name *</span>

									<input
										required
										type="text"
										value={form().first_name}
										onInput={(event) => updateField('first_name', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="First name"
									/>
								</label>

								<label class="block">
									<span class="text-sm font-semibold text-slate-800">Last name *</span>

									<input
										required
										type="text"
										value={form().last_name}
										onInput={(event) => updateField('last_name', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="Last name"
									/>
								</label>

								<label class="block">
									<span class="text-sm font-semibold text-slate-800">Email address *</span>

									<input
										required
										type="email"
										value={form().email}
										onInput={(event) => updateField('email', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="you@company.com"
									/>
								</label>

								<label class="block">
									<span class="text-sm font-semibold text-slate-800">Phone number *</span>

									<input
										required
										type="tel"
										value={form().phone}
										onInput={(event) => updateField('phone', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="+234..."
									/>
								</label>

								<label class="block">
									<span class="text-sm font-semibold text-slate-800">Company</span>

									<input
										type="text"
										value={form().company_name}
										onInput={(event) => updateField('company_name', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="Organization name"
									/>
								</label>

								<label class="block">
									<span class="text-sm font-semibold text-slate-800">Job title</span>

									<input
										type="text"
										value={form().job_title}
										onInput={(event) => updateField('job_title', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="e.g. IT Manager"
									/>
								</label>
							</div>
						</section>

						<section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<div>
								<p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Step 3</p>

								<h2 class="mt-2 text-xl font-bold text-slate-950">Delivery & requirements</h2>

								<p class="mt-1 text-sm leading-6 text-slate-500">
									Help us understand your budget, timeline and delivery requirements.
								</p>
							</div>

							<div class="mt-6 grid gap-5 sm:grid-cols-2">
								<label class="block">
									<span class="text-sm font-semibold text-slate-800">Budget range</span>

									<select
										value={form().budget_range}
										onChange={(event) => updateField('budget_range', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
									>
										<option value="">Select a budget range</option>

										<option value="Under ₦500,000">Under ₦500,000</option>

										<option value="₦500,000 - ₦1,000,000">₦500,000 – ₦1,000,000</option>

										<option value="₦1,000,000 - ₦5,000,000">₦1,000,000 – ₦5,000,000</option>

										<option value="₦5,000,000 - ₦10,000,000">₦5,000,000 – ₦10,000,000</option>

										<option value="Above ₦10,000,000">Above ₦10,000,000</option>
									</select>
								</label>

								<label class="block min-w-0">
									<span class="text-sm font-semibold text-slate-800">Required by</span>

									<div class="relative mt-2 min-w-0">
										<input
											type="date"
											value={form().required_by_date}
											onInput={(event) =>
												updateField('required_by_date', event.currentTarget.value)
											}
											class="block min-h-12 w-full min-w-0 max-w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-4 pr-11 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										/>

										<FiCalendar
											aria-hidden="true"
											class="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
										/>
									</div>
								</label>

								<label class="block sm:col-span-2">
									<span class="text-sm font-semibold text-slate-800">Delivery address</span>

									<input
										type="text"
										value={form().delivery_address}
										onInput={(event) => updateField('delivery_address', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="Street address"
									/>
								</label>

								<label class="block">
									<span class="text-sm font-semibold text-slate-800">City</span>

									<input
										type="text"
										value={form().delivery_city}
										onInput={(event) => updateField('delivery_city', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="City"
									/>
								</label>

								<label class="block">
									<span class="text-sm font-semibold text-slate-800">State</span>

									<input
										type="text"
										value={form().delivery_state}
										onInput={(event) => updateField('delivery_state', event.currentTarget.value)}
										class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="State"
									/>
								</label>

								<label class="block sm:col-span-2">
									<span class="text-sm font-semibold text-slate-800">
										Anything else we should know?
									</span>

									<textarea
										rows="5"
										value={form().additional_requirements}
										onInput={(event) =>
											updateField('additional_requirements', event.currentTarget.value)
										}
										class="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
										placeholder="Tell us about deployment, configuration, delivery, installation or any other requirements..."
									/>
								</label>
							</div>
						</section>
					</div>

					<div>
						<section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Step 2</p>

									<h2 class="mt-2 text-xl font-bold text-slate-950">What do you need?</h2>

									<p class="mt-1 text-sm leading-6 text-slate-500">
										Add the products, equipment or technology you want us to source.
									</p>
								</div>

								<button
									type="button"
									onClick={addItem}
									class="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
								>
									<FiPlus class="size-4" />
									Add product
								</button>
							</div>

							<div class="mt-6 space-y-4">
								<For each={items()}>
									{(item, index) => (
										<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
											<div class="flex items-center justify-between gap-4">
												<div>
													<p class="text-sm font-bold text-slate-950">Product {index() + 1}</p>

													<p class="mt-1 text-xs text-slate-500">
														Add the item and any specific configuration you require.
													</p>
												</div>

												<Show when={items().length > 1}>
													<button
														type="button"
														onClick={() => removeItem(index())}
														class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600"
														aria-label={`Remove product ${index() + 1}`}
													>
														<FiTrash2 class="size-4" />
													</button>
												</Show>
											</div>

											<div class="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_150px]">
												<label class="block">
													<span class="text-sm font-semibold text-slate-800">
														Product or technology *
													</span>

													<input
														required
														type="text"
														value={item.product_name}
														onInput={(event) =>
															updateItem(index(), 'product_name', event.currentTarget.value)
														}
														class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
														placeholder="e.g. HP ProBook 440 G11"
													/>
												</label>

												<label class="block">
													<span class="text-sm font-semibold text-slate-800">Quantity *</span>

													<div class="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-slate-300 bg-white">
														<button
															type="button"
															onClick={() =>
																updateItem(index(), 'quantity', Math.max(1, item.quantity - 1))
															}
															class="flex w-10 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
															aria-label="Decrease quantity"
														>
															<FiMinus class="size-4" />
														</button>

														<input
															required
															min="1"
															type="number"
															value={item.quantity}
															onInput={(event) =>
																updateItem(
																	index(),
																	'quantity',
																	Math.max(1, Number(event.currentTarget.value) || 1),
																)
															}
															class="min-w-0 flex-1 border-x border-slate-200 bg-white text-center text-sm font-bold text-slate-950 outline-none"
														/>

														<button
															type="button"
															onClick={() => updateItem(index(), 'quantity', item.quantity + 1)}
															class="flex w-10 shrink-0 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
															aria-label="Increase quantity"
														>
															<FiPlus class="size-4" />
														</button>
													</div>
												</label>
											</div>

											<label class="mt-5 block">
												<span class="text-sm font-semibold text-slate-800">
													Specifications or requirements
												</span>

												<textarea
													rows="4"
													value={item.specifications}
													onInput={(event) =>
														updateItem(index(), 'specifications', event.currentTarget.value)
													}
													class="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
													placeholder="Model, processor, memory, storage, licensing, warranty or any other requirements..."
												/>
											</label>
										</div>
									)}
								</For>
							</div>

							<button
								type="button"
								onClick={addItem}
								class="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 px-4 text-sm font-bold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50"
							>
								<FiPlus class="size-4" />
								Add another product
							</button>
						</section>
					</div>
				</div>

				<Show when={errorMessage()}>
					<div
						role="alert"
						class="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
					>
						{errorMessage()}
					</div>
				</Show>

				<div class="mt-6 rounded-3xl border border-blue-500 p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
					<div>
						<p class="text-sm font-bold text-blue-500">Ready to send your request?</p>

						<p class="mt-1 max-w-2xl text-xs leading-5 text-blue-500">
							Submitting this form does not commit you to a purchase. Our team will review your
							requirements before preparing a quote.
						</p>
					</div>

					<button
						type="submit"
						disabled={submitting()}
						class="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#000033] px-6 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0 sm:w-auto sm:shrink-0"
					>
						<Show
							when={!submitting()}
							fallback={
								<>
									<FiLoader class="size-4 animate-spin" />
									Submitting...
								</>
							}
						>
							<FiSend class="size-4" />
							Submit request
						</Show>
					</button>
				</div>
			</form>
		</Show>
	);
}
