import { tweakmartSupabase } from './supabase-server';

export type SiteNotificationType = 'info' | 'success' | 'warning' | 'promotion';

export interface SiteNotification {
	id: string;
	title: string;
	message: string;
	link_text: string | null;
	link_url: string | null;
	notification_type: SiteNotificationType;
	priority: number;
}

/*
 * Loads active TweakMart storefront notifications whose scheduling
 * window includes the current time.
 */
export async function getActiveSiteNotifications(): Promise<SiteNotification[]> {
	const now = new Date().toISOString();

	const { data, error } = await tweakmartSupabase
		.from('site_notifications')
		.select(
			`
                id,
                title,
                message,
                link_text,
                link_url,
                notification_type,
                priority
            `,
		)
		.eq('is_active', true)
		.or(`starts_at.is.null,starts_at.lte.${now}`)
		.or(`ends_at.is.null,ends_at.gt.${now}`)
		.order('priority', {
			ascending: false,
		})
		.order('created_at', {
			ascending: false,
		});

	/*
	 * Keeps the storefront operational if notification loading fails.
	 */
	if (error) {
		console.error('Unable to load TweakMart site notifications:', error);

		return [];
	}

	return (data ?? []) as SiteNotification[];
}
