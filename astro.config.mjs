// @ts-check
import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeCallouts from './src/plugins/rehype-callouts.mjs';
import tiniriLight from './src/styles/shiki/tiniri-light.json' with { type: 'json' };
import tiniriDark from './src/styles/shiki/tiniri-dark.json' with { type: 'json' };

// https://astro.build/config
export default defineConfig({
	markdown: {
		remarkPlugins: [remarkMath],
		rehypePlugins: [rehypeKatex, rehypeCallouts],
		shikiConfig: {
			themes: {
				light: tiniriLight,
				dark: tiniriDark
			}
		}
	}
});
