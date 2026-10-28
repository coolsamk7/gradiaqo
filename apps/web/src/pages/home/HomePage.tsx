import { CallToAction } from './CallToAction.tsx';
import { Features } from './Features.tsx';
import { Hero } from './Hero.tsx';
import styles from './HomePage.module.css';
import { HowItWorks } from './HowItWorks.tsx';
import { SiteFooter } from './SiteFooter.tsx';
import { SiteHeader } from './SiteHeader.tsx';

/** The public homepage: what Gradiaqo is, for people who aren't logged in. */
export function HomePage() {
    return (
        <>
            <a href="#main" className={styles.skipLink}>Skip to content</a>
            <SiteHeader />
            <main id="main">
                <Hero />
                <Features />
                <HowItWorks />
                <CallToAction />
            </main>
            <SiteFooter />
        </>
    );
}
