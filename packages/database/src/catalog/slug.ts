/** "Arrays & Hashing" → "arrays-hashing", "Alice's Workspace" → "alices-workspace". */
export function toSlug( title: string ): string {
    return title
        .toLowerCase()
        .replace( /'/g, '' )
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /^-|-$/g, '' );
}
