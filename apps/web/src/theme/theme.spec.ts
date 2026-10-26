import { savedTheme, setTheme, startTheme, THEME_KEY } from './theme.ts';

/** A system setting of `dark`, with a way to change it like the user changing their device's setting. */
function systemSetting( dark: boolean ) {
    const listeners: ( () => void )[] = [];
    const query = {
        matches: dark,
        addEventListener: ( type: string, listener: () => void ) => type === 'change' && listeners.push( listener ),
    };

    vi.stubGlobal( 'matchMedia', ( media: string ) => ( media === '(prefers-color-scheme: dark)' ? query : { matches: !dark } ) );

    return ( next: boolean ) => {
        query.matches = next;
        listeners.forEach( ( listener ) => listener() );
    };
}

const theme = () => document.documentElement.dataset.theme;

afterEach( () => {
    vi.unstubAllGlobals();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
} );

describe( 'savedTheme', () => {
    it( 'uses the key index.html reads', () => {
        expect( THEME_KEY ).toBe( 'studylog-theme' );
    } );

    it( 'is the saved choice, or system', () => {
        expect( savedTheme() ).toBe( 'system' );
        localStorage.setItem( THEME_KEY, 'dark' );
        expect( savedTheme() ).toBe( 'dark' );
        localStorage.setItem( THEME_KEY, 'light' );
        expect( savedTheme() ).toBe( 'light' );
        localStorage.setItem( THEME_KEY, 'purple' );
        expect( savedTheme() ).toBe( 'system' );
    } );

    it( 'is system when storage can\'t be read', () => {
        vi.spyOn( Storage.prototype, 'getItem' ).mockImplementation( () => {
            throw new Error( 'blocked' );
        } );
        expect( savedTheme() ).toBe( 'system' );
    } );
} );

describe( 'setTheme', () => {
    it( 'remembers light and dark, and forgets the choice for system', () => {
        systemSetting( false );

        setTheme( 'dark' );
        expect( localStorage.getItem( THEME_KEY ) ).toBe( 'dark' );
        expect( theme() ).toBe( 'dark' );

        setTheme( 'light' );
        expect( localStorage.getItem( THEME_KEY ) ).toBe( 'light' );
        expect( theme() ).toBe( 'light' );

        setTheme( 'system' );
        expect( localStorage.getItem( THEME_KEY ) ).toBeNull();
        expect( theme() ).toBe( 'light' );
    } );

    it( 'still switches the page when storage can\'t be written', () => {
        vi.spyOn( Storage.prototype, 'setItem' ).mockImplementation( () => {
            throw new Error( 'full' );
        } );
        setTheme( 'dark' );
        expect( theme() ).toBe( 'dark' );
    } );
} );

describe( 'startTheme', () => {
    it( 'follows the system setting, also when it changes', () => {
        const change = systemSetting( true );

        startTheme();
        expect( theme() ).toBe( 'dark' );
        change( false );
        expect( theme() ).toBe( 'light' );
    } );

    it( 'keeps a saved choice when the system setting changes', () => {
        const change = systemSetting( false );

        localStorage.setItem( THEME_KEY, 'dark' );
        startTheme();
        change( false );
        expect( theme() ).toBe( 'dark' );
    } );

    it( 'is light without a system setting', () => {
        vi.stubGlobal( 'matchMedia', undefined );
        startTheme();
        expect( theme() ).toBe( 'light' );
    } );
} );
