import type { Component } from 'solid-js';

interface TiptapMark {
	type?: string;
	attrs?: Record<string, unknown>;
}

interface TiptapNode {
	type?: string;
	attrs?: Record<string, unknown>;
	content?: TiptapNode[];
	marks?: TiptapMark[];
	text?: string;
}

interface TiptapDocument {
	type?: string;
	content?: TiptapNode[];
}

interface TiptapViewerProps {
	content: TiptapDocument | null | undefined;
}

/* Returns the text alignment class stored on a Tiptap node. */
function getTextAlignClass(node: TiptapNode) {
	const textAlign = node.attrs?.textAlign;

	if (textAlign === 'center') {
		return 'text-center';
	}

	if (textAlign === 'right') {
		return 'text-right';
	}

	if (textAlign === 'justify') {
		return 'text-justify';
	}

	return '';
}

/* Converts a Tiptap heading's text into a stable in-page anchor. */
function createHeadingId(node: TiptapNode) {
	const text = getNodeText(node);

	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

/* Extracts plain text recursively from a Tiptap node. */
function getNodeText(node: TiptapNode): string {
	if (node.type === 'text') {
		return node.text ?? '';
	}

	return (node.content ?? []).map(getNodeText).join('');
}

/* Applies supported Tiptap inline marks to a text node. */
function renderText(node: TiptapNode) {
	let rendered: any = node.text ?? '';

	for (const mark of node.marks ?? []) {
		if (mark.type === 'bold') {
			rendered = <strong>{rendered}</strong>;
		}

		if (mark.type === 'italic') {
			rendered = <em>{rendered}</em>;
		}

		if (mark.type === 'strike') {
			rendered = <s>{rendered}</s>;
		}

		if (mark.type === 'code') {
			rendered = (
				<code class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800">
					{rendered}
				</code>
			);
		}

		if (mark.type === 'link') {
			const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '#';

			rendered = (
				<a
					href={href}
					target={mark.attrs?.target === '_blank' ? '_blank' : undefined}
					rel={mark.attrs?.target === '_blank' ? 'noopener noreferrer' : undefined}
					class="font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700"
				>
					{rendered}
				</a>
			);
		}
	}

	return rendered;
}

/* Recursively renders one structured Tiptap document node. */
function renderNode(node: TiptapNode): any {
	if (node.type === 'text') {
		return renderText(node);
	}

	const children = () => (node.content ?? []).map((child) => renderNode(child));

	switch (node.type) {
		case 'paragraph':
			return (
				<p class={`my-5 text-[16px] leading-8 text-slate-700 ${getTextAlignClass(node)}`}>
					{children()}
				</p>
			);

		case 'heading': {
			const level = Number(node.attrs?.level ?? 2);
			const id = createHeadingId(node);

			if (level === 1) {
				return (
					<h1
						id={id}
						class="mb-4 mt-10 scroll-mt-28 text-3xl font-bold leading-tight text-slate-950"
					>
						{children()}
					</h1>
				);
			}

			if (level === 3) {
				return (
					<h3 id={id} class="mb-3 mt-8 scroll-mt-28 text-xl font-bold leading-tight text-slate-950">
						{children()}
					</h3>
				);
			}

			return (
				<h2 id={id} class="mb-4 mt-10 scroll-mt-28 text-2xl font-bold leading-tight text-slate-950">
					{children()}
				</h2>
			);
		}

		case 'bulletList':
			return <ul class="my-5 list-disc space-y-2 pl-6 text-slate-700">{children()}</ul>;

		case 'orderedList':
			return <ol class="my-5 list-decimal space-y-2 pl-6 text-slate-700">{children()}</ol>;

		case 'listItem':
			return <li class="pl-1 leading-7">{children()}</li>;

		case 'blockquote':
			return (
				<blockquote class="my-7 border-l-4 border-blue-600 bg-blue-50 px-5 py-4 text-slate-700">
					{children()}
				</blockquote>
			);

		case 'codeBlock':
			return (
				<pre class="my-7 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
					<code>{getNodeText(node)}</code>
				</pre>
			);

		case 'hardBreak':
			return <br />;

		case 'horizontalRule':
			return <hr class="my-10 border-slate-200" />;

		case 'image': {
			const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';

			const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';

			if (!src) {
				return null;
			}

			return (
				<figure class="my-8 overflow-hidden rounded-2xl">
					<img src={src} alt={alt} loading="lazy" class="h-auto w-full object-cover" />
				</figure>
			);
		}

		case 'doc':
			return children();

		default:
			return children();
	}
}

/* Renders the structured JSON produced by the shared Tiptap blog editor. */
const TiptapViewer: Component<TiptapViewerProps> = (props) => {
	return (
		<div class="min-w-0">{(props.content?.content ?? []).map((node) => renderNode(node))}</div>
	);
};

export default TiptapViewer;
