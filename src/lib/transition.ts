/**
 * view-transition-name for a product's photo, shared by its card and its detail page so the
 * browser morphs one into the other. Names must be valid CSS idents (no leading digit), hence
 * the prefix, and unique per page: only use it once per product on any page.
 */
export const productImageTransition = (slug: string) => `view-transition-name: product-${slug}`;
