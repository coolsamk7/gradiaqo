import { strykerConfig } from '@studylog/common/stryker/config';

// The dummy data is plain data (like the entities): changing a title there tests nothing.
export default strykerConfig( { ignore: [ 'src/seed/seed-content.ts' ] } );
