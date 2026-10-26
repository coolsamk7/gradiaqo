/**
 * Light or dark: the user's choice, remembered in this browser, or the system setting. The choice is applied as
 * `data-theme` on <html>, which switches the color tokens in index.css. index.html runs the same rule before the
 * first paint, so a dark page doesn't flash light while the app loads.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

/** localStorage key. index.html reads it too. */
export const THEME_KEY = 'studylog-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The saved choice; 'system' when there is none, or storage can't be read (such as in a private window). */
export function savedTheme(): ThemeChoice {
    try {
        const saved = localStorage.getItem( THEME_KEY );

        return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch {
        return 'system';
    }
}

function systemTheme(): 'light' | 'dark' {
    return typeof window.matchMedia === 'function' && window.matchMedia( DARK_QUERY ).matches ? 'dark' : 'light';
}

function apply( choice: ThemeChoice ) {
    document.documentElement.dataset.theme = choice === 'system' ? systemTheme() : choice;
}

/** Saves the choice (forgetting it for 'system') and switches the page to it. */
export function setTheme( choice: ThemeChoice ) {
    try {
        if ( choice === 'system' ) {
            localStorage.removeItem( THEME_KEY );
        } else {
            localStorage.setItem( THEME_KEY, choice );
        }
    } catch {
        // Not remembered, but this page still switches.
    }
    apply( choice );
}

/** Applies the saved choice, and follows changes to the system setting while the choice is 'system'. */
export function startTheme() {
    apply( savedTheme() );
    if ( typeof window.matchMedia === 'function' ) {
        window.matchMedia( DARK_QUERY ).addEventListener( 'change', () => apply( savedTheme() ) );
    }
}
