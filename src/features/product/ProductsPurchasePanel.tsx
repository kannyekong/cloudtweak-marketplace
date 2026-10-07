import { createMemo, createSignal, For } from 'solid-js';

import { addToCart } from '../../lib/tweakmart/cart';

import type {
	StorefrontProductDetails,
	StorefrontProductVariant,
} from '../../lib/tweakmart/storefront-products';

interface ProductPurchasePanelProps {
	product: StorefrontProductDetails;
}

/* Formats product prices using the product currency. */
function formatPrice(value: number, currency: string) {
	return new Intl.NumberFormat('en-NG', {
		style: 'currency',
		currency: currency || 'NGN',
		maximumFractionDigits: 0,
	}).format(value);
}

/* Renders the interactive product variant, quantity, price, and purchase controls. */
export default function ProductPurchasePanel(props: ProductPurchasePanelProps) {
	/* Finds the configured default variant or falls back to the first available variant. */
	const initialVariant =
		props.product.variants.find((variant) => variant.is_default) ??
		props.product.variants[0] ??
		null;

	const [selectedVariant, setSelectedVariant] = createSignal<StorefrontProductVariant | null>(
		initialVariant,
	);

	const [quantity, setQuantity] = createSignal(1);
	const [cartStatus, setCartStatus] = createSignal<'idle' | 'added'>('idle');

	/*
	 * Determines whether the product has meaningful customer-selectable
	 * variants. A single internal "Default" variant remains hidden.
	 */
	const hasSelectableVariants = createMemo(() => {
		if (props.product.variants.length === 0) {
			return false;
		}

		if (props.product.variants.length > 1) {
			return true;
		}

		return props.product.variants[0]?.name.toLowerCase() !== 'default';
	});

	/* Determines the currently applicable product price. */
	const currentPrice = createMemo(() => {
		return selectedVariant()?.price ?? props.product.base_price;
	});

	/* Determines the currently applicable compare-at price. */
	const currentComparePrice = createMemo(() => {
		return selectedVariant()?.compare_at_price ?? props.product.compare_at_price;
	});

	/* Determines stock using the selected variant when one exists. */
	const currentInventory = createMemo(() => {
		return selectedVariant()?.inventory ?? props.product.inventory;
	});

	/* Determines whether the current configuration has a genuine discount. */
	const hasDiscount = createMemo(() => {
		const comparePrice = currentComparePrice();

		return comparePrice !== null && comparePrice > currentPrice();
	});

	/* Calculates the percentage discount for the selected configuration. */
	const discountPercentage = createMemo(() => {
		const comparePrice = currentComparePrice();

		if (!comparePrice || !hasDiscount()) {
			return null;
		}

		return Math.round(((comparePrice - currentPrice()) / comparePrice) * 100);
	});

	/* Determines the maximum selectable quantity for tracked inventory. */
	const maximumQuantity = createMemo(() => {
		const inventory = currentInventory();

		if (!inventory.track_inventory || inventory.allow_backorder) {
			return 99;
		}

		return Math.max(1, inventory.available_stock);
	});

	/* Adds the currently selected product configuration to the persistent TweakMart cart. */
	function handleAddToCart() {
		if (!currentInventory().in_stock) {
			return;
		}

		/*
		 * The selected default variant is intentionally passed to the cart
		 * even when its "Default" label is hidden from the customer.
		 */
		addToCart({
			product: props.product,
			variant: selectedVariant(),
			quantity: quantity(),
		});

		setCartStatus('added');

		window.setTimeout(() => {
			setCartStatus('idle');
		}, 1600);
	}

	/* Selects a product variant and resets quantity to a valid starting value. */
	function selectVariant(variant: StorefrontProductVariant) {
		setSelectedVariant(variant);
		setQuantity(1);
	}

	/* Decreases the requested quantity without allowing values below one. */
	function decreaseQuantity() {
		setQuantity((current) => Math.max(1, current - 1));
	}

	/* Increases quantity while respecting tracked inventory. */
	function increaseQuantity() {
		if (!currentInventory().in_stock) {
			return;
		}

		setQuantity((current) => Math.min(maximumQuantity(), current + 1));
	}

	return (
		<div>
			<div class="flex flex-wrap items-end gap-x-3 gap-y-2">
				<span class="text-3xl font-bold tracking-[-0.035em] text-slate-950">
					{formatPrice(currentPrice(), props.product.currency)}
				</span>

				{hasDiscount() && currentComparePrice() !== null && (
					<span class="pb-1 text-sm font-semibold text-slate-400 line-through">
						{formatPrice(currentComparePrice()!, props.product.currency)}
					</span>
				)}

				{discountPercentage() !== null && (
					<span class="bg-primary/10 text-primary mb-1 rounded-full px-2.5 py-1 text-[10px] font-bold">
						Save {discountPercentage()}%
					</span>
				)}
			</div>

			<div class="mt-4 flex items-center gap-2">
				<span
					class={`h-2 w-2 rounded-full ${
						currentInventory().in_stock ? 'bg-emerald-500' : 'bg-rose-500'
					}`}
				/>

				<span
					class={`text-xs font-semibold ${
						currentInventory().in_stock ? 'text-emerald-600' : 'text-rose-600'
					}`}
				>
					{currentInventory().in_stock ? 'In stock' : 'Currently unavailable'}
				</span>

				{currentInventory().track_inventory &&
					currentInventory().in_stock &&
					!currentInventory().allow_backorder && (
						<span class="text-xs text-slate-400">
							· {currentInventory().available_stock} available
						</span>
					)}
			</div>

			{hasSelectableVariants() && (
				<div class="mt-8">
					<div class="flex items-center justify-between gap-4">
						<div>
							<h2 class="text-sm font-semibold text-slate-950">Select option</h2>

							<p class="mt-1 text-xs text-slate-500">
								Choose the configuration that works for you.
							</p>
						</div>

						<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">
							{props.product.variants.length}{' '}
							{props.product.variants.length === 1 ? 'option' : 'options'}
						</span>
					</div>

					<div class="mt-3 grid gap-2">
						<For each={props.product.variants}>
							{(variant) => {
								const variantPrice = variant.price ?? props.product.base_price;

								return (
									<button
										type="button"
										onClick={() => selectVariant(variant)}
										disabled={!variant.inventory.in_stock}
										aria-pressed={selectedVariant()?.id === variant.id}
										class={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
											selectedVariant()?.id === variant.id
												? 'border-primary bg-primary/5 ring-primary/10 ring-2'
												: 'border-slate-200 hover:border-slate-400'
										} ${!variant.inventory.in_stock ? 'cursor-not-allowed opacity-50' : ''}`}
									>
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<span class="truncate text-sm font-semibold text-slate-900">
													{variant.name}
												</span>

												{variant.is_default && (
													<span class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider">
														Default
													</span>
												)}
											</div>

											<div class="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
												<span class="font-medium text-slate-400">SKU: {variant.sku}</span>

												<span
													class={
														variant.inventory.in_stock
															? 'font-semibold text-emerald-600'
															: 'font-semibold text-rose-600'
													}
												>
													{variant.inventory.in_stock ? 'Available' : 'Unavailable'}
												</span>
											</div>
										</div>

										<span class="shrink-0 text-sm font-bold text-slate-950">
											{formatPrice(variantPrice, props.product.currency)}
										</span>
									</button>
								);
							}}
						</For>
					</div>
				</div>
			)}

			<div class="mt-7 grid grid-cols-[104px_minmax(0,1fr)] gap-3">
				<div class="flex h-12 items-center justify-between rounded-xl border border-slate-200 bg-white px-2">
					<button
						type="button"
						onClick={decreaseQuantity}
						disabled={quantity() <= 1}
						class="hover:text-primary flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
						aria-label="Decrease quantity"
					>
						−
					</button>

					<span class="min-w-5 text-center text-sm font-bold text-slate-950">{quantity()}</span>

					<button
						type="button"
						onClick={increaseQuantity}
						disabled={!currentInventory().in_stock || quantity() >= maximumQuantity()}
						class="hover:text-primary flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
						aria-label="Increase quantity"
					>
						+
					</button>
				</div>

				<button
					type="button"
					onClick={handleAddToCart}
					disabled={!currentInventory().in_stock}
					class={`flex h-12 w-full items-center justify-center rounded-xl px-6 text-sm font-bold transition-all duration-200 ${
						cartStatus() === 'added'
							? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/15'
							: currentInventory().in_stock
								? 'bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl active:translate-y-0'
								: 'cursor-not-allowed bg-slate-100 text-slate-400 shadow-none'
					}`}
				>
					{cartStatus() === 'added'
						? 'Added to cart'
						: currentInventory().in_stock
							? 'Add to cart'
							: 'Currently unavailable'}
				</button>
			</div>

			{selectedVariant() && <input type="hidden" name="variant_id" value={selectedVariant()!.id} />}

			<input type="hidden" name="quantity" value={quantity()} />
		</div>
	);
}
