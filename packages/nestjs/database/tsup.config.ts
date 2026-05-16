import { defineConfig } from 'tsup';

export default defineConfig( {
    entry: {
        entities: 'src/entities/index.ts',
    },
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    format: [ 'cjs', 'esm' ],
} );
