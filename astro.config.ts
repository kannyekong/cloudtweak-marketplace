import solidJs from '@astrojs/solid-js';
import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import { defineConfig, envField } from 'astro/config';

/* Configures the TweakMart Astro storefront. */
export default defineConfig({
	integrations: [
		tailwind({
			applyBaseStyles: false,
		}),
		icon(),
		solidJs(),
	],

	site: 'http://localhost:4321',

	output: 'server',

	vite: {
		build: {
			/* Keeps CSS assets inline using the storefront's existing build behavior. */
			assetsInlineLimit(filePath) {
				return filePath.endsWith('css');
			},
		},
	},

	image: {
		domains: ['localhost'],
	},

	experimental: {
		env: {
			schema: {
				FATHOM_SITE_ID: envField.string({
					context: 'client',
					access: 'public',
					optional: true,
				}),
			},
		},
	},
});
