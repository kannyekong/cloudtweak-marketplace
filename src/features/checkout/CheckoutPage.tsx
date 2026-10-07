import { createEffect, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { NIGERIAN_STATES } from '~/lib/states.ts';
import { getCartItems, type TweakMartCartItem } from '~/lib/tweakmart/cart.ts';

interface ValidatedCheckoutItem {
	product_id: string;
	product_slug: string;
	product_name: string;
	product_type: string;
	variant_id: string | null;
	variant_name: string | null;
	sku: string | null;
	quantity: number;
	unit_price: number;
	line_total: number;
	currency: string;
}

interface ValidatedCheckout {
	items: ValidatedCheckoutItem[];
	currency: string;
	subtotal: number;
}

interface CheckoutSuccessResponse {
	success: true;
	checkout: ValidatedCheckout;
}

interface CheckoutErrorResponse {
	success: false;
	error: string;
}

type PaymentMethod = 'paystack' | 'pay_on_delivery';

type CheckoutResponse = CheckoutSuccessResponse | CheckoutErrorResponse;

type CheckoutFieldErrors = Record<string, string>;

interface CheckoutOrderResponse {
	success?: boolean;
	error?: string;
	field_errors?: CheckoutFieldErrors;

	order?: {
		id: string;
		order_number: string;
		access_token: string;
		payment_method: PaymentMethod;
	};

	next_action?: 'order_pending_confirmation' | 'initialize_paystack';
}

/* Formats monetary values using the checkout currency returned by the server. */
function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat('en-NG', {
		style: 'currency',
		currency: currency || 'NGN',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

/* Converts the browser cart into the minimal payload accepted by the checkout API. */
function buildCheckoutPayload(items: TweakMartCartItem[]) {
	return items.map((item) => ({
		product_id: item.product_id,
		variant_id: item.variant_id,
		quantity: item.quantity,
	}));
}

/* Checks whether a parsed checkout order response is a non-null object. */
function isCheckoutOrderResponse(value: unknown): value is CheckoutOrderResponse {
	return typeof value === 'object' && value !== null;
}

/* Renders the TweakMart customer, delivery and validated order checkout experience. */
export default function CheckoutPage() {
	const [checkout, setCheckout] = createSignal<ValidatedCheckout | null>(null);

	const [loading, setLoading] = createSignal(true);

	const [error, setError] = createSignal<string | null>(null);

	const [fieldErrors, setFieldErrors] = createSignal<CheckoutFieldErrors>({});

	const [submitting, setSubmitting] = createSignal(false);

	const [firstName, setFirstName] = createSignal('');

	const [lastName, setLastName] = createSignal('');

	const [email, setEmail] = createSignal('');

	const [phone, setPhone] = createSignal('');

	const [address, setAddress] = createSignal('');

	const [city, setCity] = createSignal('');

	const [state, setState] = createSignal('');

	const [additionalInformation, setAdditionalInformation] = createSignal('');

	const [paymentMethod, setPaymentMethod] = createSignal<PaymentMethod>('paystack');

	/* Determines whether the current delivery address qualifies for Pay on Delivery. */
	const payOnDeliveryEligible = createMemo(() => state().trim().toLowerCase() === 'lagos');

	/* Calculates the number of physical units represented by the validated checkout. */
	const itemCount = createMemo(
		() => checkout()?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
	);

	/* Returns the customer to online payment if their delivery address no longer qualifies for POD. */
	createEffect(() => {
		if (paymentMethod() === 'pay_on_delivery' && !payOnDeliveryEligible()) {
			setPaymentMethod('paystack');
		}
	});

	/* Removes a specific field error as soon as the customer edits that field again. */
	function clearFieldError(field: string) {
		setFieldErrors((current) => {
			if (!current[field]) {
				return current;
			}

			const next = { ...current };
			delete next[field];

			return next;
		});
	}

	/* Reloads and validates the local cart against current server-side TweakMart data. */
	async function validateCheckout() {
		setLoading(true);
		setError(null);
		setFieldErrors({});

		try {
			const cartItems = getCartItems();

			if (cartItems.length === 0) {
				setError('Your cart is empty.');

				return;
			}

			const response = await fetch('/api/checkout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					items: buildCheckoutPayload(cartItems),
				}),
			});

			const responseText = await response.text();

			let result: CheckoutResponse | null = null;

			if (responseText) {
				try {
					const parsedResponse: unknown = JSON.parse(responseText);

					if (
						typeof parsedResponse === 'object' &&
						parsedResponse !== null &&
						'success' in parsedResponse
					) {
						result = parsedResponse as CheckoutResponse;
					}
				} catch {
					result = null;
				}
			}

			if (!response.ok || !result || !result.success) {
				const message =
					result && !result.success ? result.error : 'We could not prepare your checkout.';

				setError(message);

				return;
			}

			setCheckout(result.checkout);
		} catch (checkoutError) {
			console.error('Unable to load TweakMart checkout:', checkoutError);

			setError('We could not connect to checkout. Please try again.');
		} finally {
			setLoading(false);
		}
	}

	/* Creates the order before handing online payments over to Paystack when required. */
	async function handleContinueToPayment(event: SubmitEvent) {
		event.preventDefault();

		if (submitting()) {
			return;
		}

		if (paymentMethod() === 'pay_on_delivery' && !payOnDeliveryEligible()) {
			setError('Pay on Delivery is available only for deliveries within Lagos.');

			return;
		}

		setSubmitting(true);
		setError(null);
		setFieldErrors({});

		try {
			const response = await fetch('/api/checkout/order', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					customer: {
						first_name: firstName(),
						last_name: lastName(),
						email: email(),
						phone: phone(),
					},

					delivery: {
						address: address(),
						city: city(),
						state: state(),
						notes: additionalInformation(),
					},

					payment_method: paymentMethod(),

					items: buildCheckoutPayload(getCartItems()),
				}),
			});

			const responseText = await response.text();

			let result: CheckoutOrderResponse | null = null;

			try {
				const parsedResponse: unknown = responseText ? JSON.parse(responseText) : null;

				if (parsedResponse !== null && !isCheckoutOrderResponse(parsedResponse)) {
					throw new Error('Checkout returned an invalid response.');
				}

				result = parsedResponse;
			} catch {
				throw new Error('Checkout returned an invalid response.');
			}

			if (!response.ok || !result?.success || !result.order) {
				if (result?.field_errors) {
					setFieldErrors(result.field_errors);
				}

				throw new Error(result?.error || 'Please check your checkout information and try again.');
			}

			/*
			 * Pay on Delivery orders require no online payment.
			 * They remain pending until confirmed by an administrator.
			 */
			if (
				result.order.payment_method === 'pay_on_delivery' ||
				result.next_action === 'order_pending_confirmation'
			) {
				window.location.href =
					`/orders/${encodeURIComponent(result.order.order_number)}` +
					`?token=${encodeURIComponent(result.order.access_token)}` +
					'&placed=1';

				return;
			}

			/* Only Paystack orders are permitted to reach online payment initialization. */
			if (
				result.order.payment_method !== 'paystack' ||
				result.next_action !== 'initialize_paystack'
			) {
				throw new Error('The order returned an unsupported payment action.');
			}

			/*
			 * Online orders are initialized using only the trusted
			 * server-created order ID.
			 */
			const paymentResponse = await fetch('/api/checkout/paystack/initialize', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					order_id: result.order.id,
				}),
			});

			const paymentResponseText = await paymentResponse.text();

			let paymentResult: unknown = null;

			try {
				paymentResult = paymentResponseText ? JSON.parse(paymentResponseText) : null;
			} catch {
				throw new Error('Payment initialization returned an invalid response.');
			}

			if (
				typeof paymentResult !== 'object' ||
				paymentResult === null ||
				!('success' in paymentResult) ||
				paymentResult.success !== true ||
				!('payment' in paymentResult) ||
				typeof paymentResult.payment !== 'object' ||
				paymentResult.payment === null ||
				!('authorization_url' in paymentResult.payment) ||
				typeof paymentResult.payment.authorization_url !== 'string'
			) {
				const paymentError =
					typeof paymentResult === 'object' &&
					paymentResult !== null &&
					'error' in paymentResult &&
					typeof paymentResult.error === 'string'
						? paymentResult.error
						: 'Unable to initialize payment.';

				throw new Error(paymentError);
			}

			sessionStorage.setItem(
				'tweakmart-pending-order',
				JSON.stringify({
					id: result.order.id,
					order_number: result.order.order_number,
					access_token: result.order.access_token,
				}),
			);

			window.location.href = paymentResult.payment.authorization_url;
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Unable to place your order.');
		} finally {
			setSubmitting(false);
		}
	}

	/* Validates the cart whenever the checkout island first mounts in the browser. */
	onMount(() => {
		void validateCheckout();
	});

	return (
		<div class="w-full bg-slate-50">
			<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
				<div class="mb-8">
					<a
						href="/products"
						class="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
					>
						← Continue shopping
					</a>

					<h1 class="mt-4 text-3xl font-bold tracking-tight text-slate-950">Checkout</h1>

					<p class="mt-2 text-sm text-slate-600">
						Complete your customer and delivery information.
					</p>
				</div>

				<Show when={loading()}>
					<div class="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white">
						<div class="text-center">
							<div class="mx-auto size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

							<p class="mt-4 text-sm font-medium text-slate-600">Validating your cart...</p>
						</div>
					</div>
				</Show>

				<Show when={!loading() && error() && !checkout()}>
					<div class="rounded-2xl border border-red-200 bg-white p-8 text-center">
						<div class="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-xl">
							!
						</div>

						<h2 class="mt-4 text-lg font-bold text-slate-950">Unable to continue checkout</h2>

						<p class="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{error()}</p>

						<div class="mt-6 flex justify-center gap-3">
							<a
								href="/"
								class="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
							>
								Return to store
							</a>

							<button
								type="button"
								onClick={() => void validateCheckout()}
								class="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
							>
								Try again
							</button>
						</div>
					</div>
				</Show>

				<Show when={!loading() && checkout()}>
					<form
						onSubmit={handleContinueToPayment}
						class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]"
					>
						<div class="space-y-6">
							<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
								<div class="border-b border-slate-200 pb-5">
									<p class="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Contact</p>

									<h2 class="mt-1 text-xl font-bold text-slate-950">Customer information</h2>
								</div>

								<div class="mt-6 grid gap-5 sm:grid-cols-2">
									<label class="block">
										<span class="mb-2 block text-sm font-semibold text-slate-800">First name</span>

										<input
											type="text"
											required
											autocomplete="given-name"
											value={firstName()}
											onInput={(event) => {
												setFirstName(event.currentTarget.value);
												clearFieldError('customer.first_name');
											}}
											class={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
												fieldErrors()['customer.first_name']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										/>

										<Show when={fieldErrors()['customer.first_name']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['customer.first_name']}
											</p>
										</Show>
									</label>

									<label class="block">
										<span class="mb-2 block text-sm font-semibold text-slate-800">Last name</span>

										<input
											type="text"
											required
											autocomplete="family-name"
											value={lastName()}
											onInput={(event) => {
												setLastName(event.currentTarget.value);
												clearFieldError('customer.last_name');
											}}
											class={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition ${
												fieldErrors()['customer.last_name']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										/>

										<Show when={fieldErrors()['customer.last_name']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['customer.last_name']}
											</p>
										</Show>
									</label>

									<label class="block sm:col-span-2">
										<span class="mb-2 block text-sm font-semibold text-slate-800">
											Email address
										</span>

										<input
											type="email"
											required
											autocomplete="email"
											value={email()}
											onInput={(event) => {
												setEmail(event.currentTarget.value);
												clearFieldError('customer.email');
											}}
											class={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition ${
												fieldErrors()['customer.email']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										/>

										<Show when={fieldErrors()['customer.email']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['customer.email']}
											</p>
										</Show>
									</label>

									<label class="block sm:col-span-2">
										<span class="mb-2 block text-sm font-semibold text-slate-800">
											Phone number
										</span>

										<input
											type="tel"
											required
											autocomplete="tel"
											value={phone()}
											onInput={(event) => {
												setPhone(event.currentTarget.value);
												clearFieldError('customer.phone');
											}}
											class={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition ${
												fieldErrors()['customer.phone']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										/>

										<Show when={fieldErrors()['customer.phone']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['customer.phone']}
											</p>
										</Show>
									</label>
								</div>
							</section>

							<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
								<div class="border-b border-slate-200 pb-5">
									<p class="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
										Delivery
									</p>

									<h2 class="mt-1 text-xl font-bold text-slate-950">Delivery address</h2>
								</div>

								<div class="mt-6 grid gap-5 sm:grid-cols-2">
									<label class="block sm:col-span-2">
										<span class="mb-2 block text-sm font-semibold text-slate-800">
											Street address
										</span>

										<input
											type="text"
											required
											autocomplete="street-address"
											value={address()}
											onInput={(event) => {
												setAddress(event.currentTarget.value);
												clearFieldError('delivery.address');
											}}
											class={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition ${
												fieldErrors()['delivery.address']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										/>

										<Show when={fieldErrors()['delivery.address']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['delivery.address']}
											</p>
										</Show>
									</label>

									<label class="block">
										<span class="mb-2 block text-sm font-semibold text-slate-800">City</span>

										<input
											type="text"
											required
											autocomplete="address-level2"
											value={city()}
											onInput={(event) => {
												setCity(event.currentTarget.value);
												clearFieldError('delivery.city');
											}}
											class={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition ${
												fieldErrors()['delivery.city']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										/>

										<Show when={fieldErrors()['delivery.city']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['delivery.city']}
											</p>
										</Show>
									</label>

									<label class="block">
										<span class="mb-2 block text-sm font-semibold text-slate-800">State</span>

										<select
											required
											autocomplete="address-level1"
											value={state()}
											onChange={(event) => {
												setState(event.currentTarget.value);
												clearFieldError('delivery.state');
											}}
											class={`h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition ${
												fieldErrors()['delivery.state']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										>
											<option value="">Select state</option>

											<For each={NIGERIAN_STATES}>
												{(stateName) => <option value={stateName}>{stateName}</option>}
											</For>
										</select>

										<Show when={fieldErrors()['delivery.state']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['delivery.state']}
											</p>
										</Show>
									</label>

									<label class="block sm:col-span-2">
										<span class="mb-2 block text-sm font-semibold text-slate-800">
											Delivery notes
											<span class="ml-1 font-normal text-slate-400">(optional)</span>
										</span>

										<textarea
											rows={4}
											value={additionalInformation()}
											onInput={(event) => {
												setAdditionalInformation(event.currentTarget.value);
												clearFieldError('delivery.notes');
											}}
											placeholder="Landmark, building information or delivery instructions"
											class={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 ${
												fieldErrors()['delivery.notes']
													? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
													: 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
											}`}
										/>

										<Show when={fieldErrors()['delivery.notes']}>
											<p class="mt-1.5 text-xs font-medium text-red-600">
												{fieldErrors()['delivery.notes']}
											</p>
										</Show>
									</label>
								</div>
							</section>

							<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
								<div class="border-b border-slate-200 pb-5">
									<p class="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Payment</p>

									<h2 class="mt-1 text-xl font-bold text-slate-950">Payment method</h2>

									<p class="mt-2 text-sm leading-6 text-slate-500">
										Choose how you would like to pay for your order.
									</p>
								</div>

								<div class="mt-6 space-y-3">
									<label
										class={`block cursor-pointer rounded-2xl border p-4 transition ${
											paymentMethod() === 'paystack'
												? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
												: 'border-slate-200 bg-white hover:border-slate-300'
										}`}
									>
										<div class="flex items-start gap-4">
											<input
												type="radio"
												name="payment-method"
												value="paystack"
												checked={paymentMethod() === 'paystack'}
												onChange={() => {
													setPaymentMethod('paystack');
													clearFieldError('payment_method');
												}}
												class="mt-1 size-4 accent-blue-600"
											/>

											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-center justify-between gap-2">
													<p class="text-sm font-bold text-slate-950">Pay online</p>

													<span class="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
														Paystack
													</span>
												</div>

												<p class="mt-1.5 text-sm leading-6 text-slate-600">
													Pay securely online through Paystack.
												</p>

												<p class="mt-2 text-xs font-medium text-slate-500">
													Card, bank transfer, USSD and other supported payment channels.
												</p>
											</div>
										</div>
									</label>

									<label
										class={`block rounded-2xl border p-4 transition ${
											payOnDeliveryEligible()
												? paymentMethod() === 'pay_on_delivery'
													? 'cursor-pointer border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
													: 'cursor-pointer border-slate-200 bg-white hover:border-slate-300'
												: 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
										}`}
									>
										<div class="flex items-start gap-4">
											<input
												type="radio"
												name="payment-method"
												value="pay_on_delivery"
												disabled={!payOnDeliveryEligible()}
												checked={paymentMethod() === 'pay_on_delivery'}
												onChange={() => {
													if (payOnDeliveryEligible()) {
														setPaymentMethod('pay_on_delivery');
														clearFieldError('payment_method');
													}
												}}
												class="mt-1 size-4 accent-blue-600"
											/>

											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-center justify-between gap-2">
													<p class="text-sm font-bold text-slate-950">Pay on delivery</p>

													<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
														Lagos only
													</span>
												</div>

												<p class="mt-1.5 text-sm leading-6 text-slate-600">
													Pay when your order is delivered to your Lagos address.
												</p>

												<Show when={!payOnDeliveryEligible()}>
													<p class="mt-2 text-xs font-semibold leading-5 text-amber-700">
														Select Lagos as your delivery state to use Pay on Delivery.
													</p>
												</Show>

												<Show when={payOnDeliveryEligible()}>
													<p class="mt-2 text-xs font-semibold leading-5 text-emerald-700">
														Available for this delivery address.
													</p>
												</Show>
											</div>
										</div>
									</label>

									<Show when={fieldErrors()['payment_method']}>
										<p class="text-xs font-medium text-red-600">
											{fieldErrors()['payment_method']}
										</p>
									</Show>
								</div>
							</section>
						</div>

						<aside class="lg:sticky lg:top-6 lg:self-start">
							<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
								<div class="flex items-center justify-between border-b border-slate-200 pb-5">
									<div>
										<p class="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Order</p>

										<h2 class="mt-1 text-xl font-bold text-slate-950">Order summary</h2>
									</div>

									<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
										{itemCount()} {itemCount() === 1 ? 'item' : 'items'}
									</span>
								</div>

								<div class="divide-y divide-slate-200">
									<For each={checkout()?.items ?? []}>
										{(item) => (
											<div class="flex gap-4 py-5">
												<div class="min-w-0 flex-1">
													<a
														href={`/products/${item.product_slug}`}
														class="line-clamp-2 text-sm font-bold leading-5 text-slate-900 transition hover:text-blue-600"
													>
														{item.product_name}
													</a>

													<Show when={item.variant_name}>
														<p class="mt-1 text-xs text-slate-500">{item.variant_name}</p>
													</Show>

													<p class="mt-2 text-xs font-medium text-slate-500">
														Qty: {item.quantity}
													</p>
												</div>

												<p class="shrink-0 text-sm font-bold text-slate-950">
													{formatMoney(item.line_total, item.currency)}
												</p>
											</div>
										)}
									</For>
								</div>

								<div class="space-y-3 border-t border-slate-200 pt-5">
									<div class="flex items-center justify-between text-sm">
										<span class="text-slate-600">Subtotal</span>

										<span class="font-bold text-slate-950">
											{formatMoney(checkout()?.subtotal ?? 0, checkout()?.currency ?? 'NGN')}
										</span>
									</div>

									<div class="flex items-center justify-between text-sm">
										<span class="text-slate-600">Delivery</span>

										<span class="font-semibold text-slate-500">Calculated next</span>
									</div>
								</div>

								<div class="mt-5 border-t border-slate-200 pt-5">
									<div class="flex items-end justify-between gap-4">
										<div>
											<p class="text-sm font-bold text-slate-950">Total</p>

											<p class="mt-1 text-xs text-slate-500">Before delivery</p>
										</div>

										<p class="text-xl font-black tracking-tight text-slate-950">
											{formatMoney(checkout()?.subtotal ?? 0, checkout()?.currency ?? 'NGN')}
										</p>
									</div>
								</div>

								<Show when={error()}>
									<div
										role="alert"
										class="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700"
									>
										{error()}
									</div>
								</Show>

								<button
									type="submit"
									disabled={submitting()}
									class="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
								>
									{submitting()
										? paymentMethod() === 'pay_on_delivery'
											? 'Placing order...'
											: 'Preparing payment...'
										: paymentMethod() === 'pay_on_delivery'
											? 'Place order'
											: 'Continue to Paystack'}
								</button>

								<p class="mt-4 text-center text-xs leading-5 text-slate-500">
									{paymentMethod() === 'pay_on_delivery'
										? 'Your order will be revalidated before it is placed.'
										: 'Your order will be revalidated before payment is initialized.'}
								</p>
							</div>
						</aside>
					</form>
				</Show>
			</div>
		</div>
	);
}
