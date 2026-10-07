export type TweakMartWishlistItem = {
	product_id: string;
	slug: string;
	name: string;
	price: number;
	image_url: string | null;
	brand_name?: string | null;
	saved_at: string;
};

const WISHLIST_STORAGE_KEY = 'tweakmart-wishlist';
const WISHLIST_UPDATED_EVENT = 'tweakmart:wishlist-updated';

/* Returns true when the code is running inside the browser. */
function isBrowser() {
	return typeof window !== 'undefined';
}

/* Reads and safely parses the current wishlist from localStorage. */
export function getWishlist(): TweakMartWishlistItem[] {
	if (!isBrowser()) {
		return [];
	}

	try {
		const storedWishlist = window.localStorage.getItem(WISHLIST_STORAGE_KEY);

		if (!storedWishlist) {
			return [];
		}

		const parsedWishlist = JSON.parse(storedWishlist);

		if (!Array.isArray(parsedWishlist)) {
			return [];
		}

		return parsedWishlist as TweakMartWishlistItem[];
	} catch (error) {
		console.error('Unable to read the TweakMart wishlist.', error);

		return [];
	}
}

/* Writes the complete wishlist to localStorage and notifies listening UI components. */
function saveWishlist(items: TweakMartWishlistItem[]) {
	if (!isBrowser()) {
		return;
	}

	window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));

	window.dispatchEvent(
		new CustomEvent(WISHLIST_UPDATED_EVENT, {
			detail: {
				items,
			},
		}),
	);
}

/* Returns whether a particular product is currently saved. */
export function isProductSaved(productId: string) {
	return getWishlist().some((item) => item.product_id === productId);
}

/* Adds a product to the wishlist unless it is already present. */
export function addToWishlist(item: Omit<TweakMartWishlistItem, 'saved_at'>) {
	const currentWishlist = getWishlist();

	if (currentWishlist.some((savedItem) => savedItem.product_id === item.product_id)) {
		return currentWishlist;
	}

	const nextWishlist: TweakMartWishlistItem[] = [
		...currentWishlist,
		{
			...item,
			saved_at: new Date().toISOString(),
		},
	];

	saveWishlist(nextWishlist);

	return nextWishlist;
}

/* Removes a product from the wishlist using its product ID. */
export function removeFromWishlist(productId: string) {
	const nextWishlist = getWishlist().filter((item) => item.product_id !== productId);

	saveWishlist(nextWishlist);

	return nextWishlist;
}

/* Toggles a product between saved and unsaved states. */
export function toggleWishlistItem(item: Omit<TweakMartWishlistItem, 'saved_at'>) {
	if (isProductSaved(item.product_id)) {
		removeFromWishlist(item.product_id);

		return {
			saved: false,
			items: getWishlist(),
		};
	}

	const items = addToWishlist(item);

	return {
		saved: true,
		items,
	};
}

/* Returns the total number of products currently saved. */
export function getWishlistCount() {
	return getWishlist().length;
}

/* Removes every saved item from the wishlist. */
export function clearWishlist() {
	saveWishlist([]);
}

/* Subscribes a browser callback to wishlist changes made by TweakMart components. */
export function subscribeToWishlist(callback: (items: TweakMartWishlistItem[]) => void) {
	if (!isBrowser()) {
		return () => {};
	}

	const handleWishlistUpdate = () => {
		callback(getWishlist());
	};

	const handleStorageUpdate = (event: StorageEvent) => {
		if (event.key === WISHLIST_STORAGE_KEY) {
			callback(getWishlist());
		}
	};

	window.addEventListener(WISHLIST_UPDATED_EVENT, handleWishlistUpdate);

	window.addEventListener('storage', handleStorageUpdate);

	return () => {
		window.removeEventListener(WISHLIST_UPDATED_EVENT, handleWishlistUpdate);

		window.removeEventListener('storage', handleStorageUpdate);
	};
}
