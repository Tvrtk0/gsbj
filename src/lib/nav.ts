const base = import.meta.env.BASE_URL;

export const navLinks = [
  { href: base, label: 'Početna', icon: 'home' },
  { href: `${base}products/`, label: 'Proizvodi', icon: 'grid' },
  { href: `${base}contact/`, label: 'Kontakt', icon: 'pin' },
] as const;

/**
 * Whether `href` is the page at `pathname`. Built paths end in a slash but the links don't,
 * and product detail pages count as Proizvodi.
 */
export function isActive(href: string, pathname: string): boolean {
  const current = pathname.replace(/\/$/, '');
  const target = href.replace(/\/$/, '');
  return target === base.replace(/\/$/, '') ? current === target : current.startsWith(target);
}
