import { RiSystemDeleteBinLine } from 'solid-icons/ri';
import { Show } from 'solid-js';

import { NumberInput } from '~/components/ui/NumberInput.tsx';
import {
	removeCartItem,
	updateCartItemQuantity,
	type TweakMartCartItem,
} from '~/lib/tweakmart/cart.ts';
import { productPath } from '~/paths.ts';
import { card } from '~/styles.ts';

/* Formats a cart item price using its stored currency. */
function formatCartPrice(value: number, currency: string) {
	return new Intl.NumberFormat('en-NG', {
		style: 'currency',
		currency,
		maximumFractionDigits: 2,
	}).format(value);
}

/* Renders a TweakMart cart line item and manages its quantity and removal actions. */
export function CartItem(props: { item: TweakMartCartItem; class?: string }) {
	/* Updates the quantity of the current product and variant in the browser cart. */
	function handleQuantityChange(quantity: number) {
		if (quantity <= 0) {
			handleRemove();
			return;
		}

		updateCartItemQuantity(props.item.product_id, props.item.variant_id, quantity);
	}

	/* Removes the current product and variant from the browser cart. */
	function handleRemove() {
		removeCartItem(props.item.product_id, props.item.variant_id);
	}

	return (
		<div class={`flex items-start gap-4 ${props.class ?? ''}`}>
			<a
				href={productPath(props.item.product_slug)}
				class={card({
					className: 'w-28 shrink-0 sm:w-32',
				})}
			>
				<Show
					when={props.item.image_url}
					fallback={
						<div class="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
							No image
						</div>
					}
				>
					<img
						src={props.item.image_url ?? ''}
						width={128}
						height={128}
						alt={props.item.product_name}
						loading="lazy"
						class="aspect-square h-full w-full object-contain"
					/>
				</Show>
			</a>

			<div class="min-w-0 flex-1">
				<a href={productPath(props.item.product_slug)} class="block">
					<p class="hover:text-primary py-2 text-lg/none font-medium text-slate-700 transition-colors dark:text-slate-200">
						{props.item.product_name}
					</p>
				</a>

				<Show when={props.item.variant_name}>
					<p class="-mt-[3px] text-sm font-medium text-slate-500 dark:text-slate-400">
						{props.item.variant_name}
					</p>
				</Show>

				<Show when={props.item.sku}>
					<p class="mt-1 text-xs text-slate-400 dark:text-slate-500">SKU: {props.item.sku}</p>
				</Show>

				<div class="py-2">
					<p class="font-medium leading-none text-slate-700 dark:text-slate-200">
						{formatCartPrice(props.item.unit_price, props.item.currency)}
					</p>

					<Show when={props.item.quantity > 1}>
						<p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
							{formatCartPrice(props.item.unit_price * props.item.quantity, props.item.currency)}{' '}
							total
						</p>
					</Show>
				</div>

				<NumberInput min={0} max={20} value={props.item.quantity} setValue={handleQuantityChange} />
			</div>

			<button
				type="button"
				aria-label={`Remove ${props.item.product_name} from cart`}
				class="-my-2 self-end p-2 text-slate-600 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
				onClick={handleRemove}
			>
				<RiSystemDeleteBinLine class="size-6" />

				<span class="sr-only">Remove item</span>
			</button>
		</div>
	);
}
