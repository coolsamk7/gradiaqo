import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import styles from './Markdown.module.css';

// A line break stays one, as in text typed in the app.
const plugins = [ remarkGfm, remarkBreaks ];
const components = {
    // Study material is somewhere else: keep the path open.
    a: ( { node: _node, ...props }: ComponentProps<'a'> & { node?: unknown } ) => (
        <a {...props} target="_blank" rel="noopener noreferrer" />
    ),
};

/**
 * Text written as Markdown (a note, an exercise's instructions or answer), with tables and task lists; plain text
 * shows as typed. Anyone can write it in their own paths, so HTML in it is never rendered (inline tags show as text)
 * and only safe links (http, https, mailto…) are kept.
 */
export function Markdown( { text, className }: { text: string; className?: string } ) {
    return (
        <div className={[ styles.markdown, className ].filter( Boolean ).join( ' ' )}>
            <ReactMarkdown remarkPlugins={plugins} components={components}>{text}</ReactMarkdown>
        </div>
    );
}
