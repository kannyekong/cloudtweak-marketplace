import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { FiHeart, FiShoppingBag, FiTrash2 } from 'solid-icons/fi';

import {
	clearWishlist,
	getWishlist,
	removeFromWishlist,
	subscribeToWishlist,
	type TweakMartWishlistItem,
} from '../../lib/tweakmart/wishlist';

/* Formats a stored wishlist price using Nigerian currency formatting. */
function formatPrice(value: number) {
	return new Intl.NumberFormat('en-NG', {
		style: 'currency',
		currency: 'NGN',
		maximumFractionDigits: 0,
	}).format(value);
}

/* Renders and synchronizes the customer's locally saved TweakMart products. */
export default function SavedItemsPage() {
	const [items, setItems] = createSignal<TweakMartWishlistItem[]>([]);
	const [hydrated, setHydrated] = createSignal(false);

	/* Loads saved items after hydration and keeps the page synchronized with wishlist changes. */
	onMount(() => {
		setItems(getWishlist());
		setHydrated(true);

		const unsubscribe = subscribeToWishlist((nextItems) => {
			setItems(nextItems);
		});

		onCleanup(unsubscribe);
	});

	/* Removes one product from saved items. */
	function handleRemove(productId: string) {
		const nextItems = removeFromWishlist(productId);

		setItems(nextItems);
	}

	/* Clears every product from the locally stored wishlist. */
	function handleClearAll() {
		clearWishlist();
		setItems([]);
	}

	return (
		<div>
			<Show
				when={hydrated()}
				fallback={
					<div class="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center">
						<p class="text-sm font-medium text-slate-500">Loading saved items...</p>
					</div>
				}
			>
				<Show
					when={items().length > 0}
					fallback={
						<div class="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center sm:px-10">
							<div class="mx-auto flex size-16 items-center justify-center rounded-2xl bg-slate-100">
								<FiHeart class="size-7 text-slate-400" />
							</div>

							<h2 class="mt-6 text-xl font-bold tracking-tight text-slate-950">
								No saved items yet
							</h2>

							<p class="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
								Save products you're interested in and they'll appear here for easy access later.
							</p>

							<a
								href="/products"
								class="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
							>
								<FiShoppingBag class="size-4" />
								Browse products
							</a>
						</div>
					}
				>
					<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p class="text-sm font-medium text-slate-500">
								{items().length} {items().length === 1 ? 'saved product' : 'saved products'}
							</p>
						</div>

						<button
							type="button"
							onClick={handleClearAll}
							class="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:self-auto"
						>
							<FiTrash2 class="size-4" />
							Clear saved items
						</button>
					</div>

					<div class="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
						<For each={items()}>
							{(item) => (
								<article class="group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
									<a
										href={`/products/${item.slug}`}
										class="flex h-full flex-col"
										aria-label={`View ${item.name}`}
									>
										<div class="relative m-2.5 mb-0 overflow-hidden rounded-[1.05rem] bg-slate-100">
											<div class="relative aspect-[4/3] overflow-hidden">
												<Show
													when={item.image_url}
													fallback={
														<div class="flex h-full w-full items-center justify-center">
															<FiShoppingBag class="size-8 text-slate-300" />
														</div>
													}
												>
													<img
														src={item.image_url ?? ''}
														alt={item.name}
														loading="lazy"
														class="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-105"
													/>
												</Show>
											</div>
										</div>

										<div class="flex flex-1 flex-col px-4 pb-4 pt-4">
											<Show when={item.brand_name}>
												<p class="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
													{item.brand_name}
												</p>
											</Show>

											<h2 class="mt-2 line-clamp-2 min-h-11 text-[15px] font-semibold leading-[1.4] tracking-[-0.01em] text-slate-950 transition group-hover:text-blue-600">
												{item.name}
											</h2>

											<div class="mt-auto pt-6">
												<div class="text-[17px] font-bold tracking-[-0.025em] text-slate-950">
													{formatPrice(item.price)}
												</div>
											</div>
										</div>
									</a>

									<button
										type="button"
										onClick={() => handleRemove(item.product_id)}
										aria-label={`Remove ${item.name} from saved items`}
										class="absolute right-[22px] top-[22px] z-20 flex size-8 items-center justify-center rounded-full border border-white/70 bg-white/90 text-red-500 shadow-sm backdrop-blur-md transition hover:bg-red-50"
									>
										<FiHeart class="size-5 fill-red-500" />
									</button>
								</article>
							)}
						</For>
					</div>
				</Show>
			</Show>
		</div>
	);
}
