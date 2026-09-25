import { coverageConfig } from '@studylog/common/vitest/coverage';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig( {
    // Compile like the Nest apps (SWC, legacy decorators + metadata), so coverage measures this code and not
    // helper branches another transform generates for decorator metadata.
    plugins: [
        swc.vite( {
            jsc: {
                parser: { syntax: 'typescript', decorators: true },
                transform: { legacyDecorator: true, decoratorMetadata: true },
                keepClassNames: true,
            },
            module: { type: 'es6' },
        } ),
    ],
    test: {
        include: [ 'src/**/*.spec.ts' ],
        coverage: coverageConfig(),
    },
} );
