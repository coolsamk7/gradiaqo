import { CatalogStatus, Item, LearningPath, Membership, PathVisibility, Topic } from '@studylog/database';
import { PathSource } from '@studylog/schemas';
import type { Brackets, DataSource } from 'typeorm';

import { CatalogAccessService } from '../../../../src/catalog/services/catalog-access.service.js';
import type { FakeDataSource } from '../../fake-data-source.js';
import { fakeDataSource, fakeQueryBuilder } from '../../fake-data-source.js';

const MY_ORG = 'my-org';
const path = ( organizationId: string | null, visibility = PathVisibility.Private, status = CatalogStatus.Published ) =>
    ( { organizationId, visibility, status } );

describe( 'CatalogAccessService', () => {
    let db: FakeDataSource;
    let access: CatalogAccessService;

    beforeEach( () => {
        db = fakeDataSource();
        db.repo( Membership ).find.mockResolvedValue( [ { organizationId: MY_ORG } ] );
        access = new CatalogAccessService( db as unknown as DataSource );
    } );

    describe( 'canSeePath', () => {
        it.each( [
            [ 'an official published path', path( null, PathVisibility.Public ), true ],
            [ 'a public path of another user', path( 'other', PathVisibility.Public ), true ],
            [ 'a private path of one of my organizations', path( MY_ORG ), true ],
            [ 'a private path of another organization', path( 'other' ), false ],
            [ 'an unpublished official path', path( null, PathVisibility.Public, CatalogStatus.Draft ), false ],
            [ 'an archived path of my organization', path( MY_ORG, PathVisibility.Private, CatalogStatus.Archived ), false ],
        ] )( '%s: %s', async ( _, candidate, visible ) => {
            expect( await access.canSeePath( 'me', candidate ) ).toBe( visible );
        } );
    } );

    describe( 'canSeeItem', () => {
        it( 'needs a published item', async () => {
            expect( await access.canSeeItem( 'me', 'item' ) ).toBe( false );
        } );

        it( 'shows global items and items of my organizations', async () => {
            db.repo( Item ).findOneBy.mockResolvedValueOnce( { organizationId: null } );
            expect( await access.canSeeItem( 'me', 'item' ) ).toBe( true );

            db.repo( Item ).findOneBy.mockResolvedValueOnce( { organizationId: MY_ORG } );
            expect( await access.canSeeItem( 'me', 'item' ) ).toBe( true );
            expect( db.query ).not.toHaveBeenCalled();
        } );

        it( 'shows another organization\'s item only if it\'s in a published public path', async () => {
            db.repo( Item ).findOneBy.mockResolvedValue( { organizationId: 'other' } );

            expect( await access.canSeeItem( 'me', 'item' ) ).toBe( false );

            db.query.mockResolvedValue( [ { '?column?': 1 } ] );
            expect( await access.canSeeItem( 'me', 'item' ) ).toBe( true );
            expect( db.query ).toHaveBeenCalledWith( expect.any( String ), [ 'item', PathVisibility.Public, CatalogStatus.Published ] );
        } );
    } );

    it( 'canSeeTopic needs a published topic and module in a visible path', async () => {
        expect( await access.canSeeTopic( 'me', 't' ) ).toBe( false );

        db.repo( Topic ).findOne.mockResolvedValue( { module: { learningPath: path( 'other' ) } } );
        expect( await access.canSeeTopic( 'me', 't' ) ).toBe( false );

        db.repo( Topic ).findOne.mockResolvedValue( { module: { learningPath: path( MY_ORG ) } } );
        expect( await access.canSeeTopic( 'me', 't' ) ).toBe( true );
        expect( db.repo( Topic ).findOne ).toHaveBeenCalledWith( expect.objectContaining( {
            where: { id: 't', status: CatalogStatus.Published, module: { status: CatalogStatus.Published } },
        } ) );
    } );

    describe( 'visiblePaths', () => {
        const pathRow = ( id: string, organization: { id: string; isPersonal: boolean } | null ) => ( {
            id,
            organizationId: organization?.id ?? null,
            organization: organization && { ...organization, name: `${id} org` },
            createdBy: organization && { id: 'creator', firstName: 'Ann', lastName: 'Lee', email: 'ann@example.com' },
        } );
        const rows = [
            pathRow( 'community', { id: 'stranger-ws', isPersonal: true } ),
            pathRow( 'group', { id: MY_ORG, isPersonal: false } ),
            pathRow( 'official', null ),
        ];

        beforeEach( () => {
            db.repo( Membership ).find.mockResolvedValue( [ { organizationId: MY_ORG }, { organizationId: 'my-ws' } ] );
            rows.push( pathRow( 'mine', { id: 'my-ws', isPersonal: true } ) );
        } );

        afterEach( () => {
            rows.pop();
        } );

        const listWith = async ( query = {} ) => {
            const builder = fakeQueryBuilder( rows );

            db.repo( LearningPath ).createQueryBuilder.mockReturnValue( builder );

            return { paths: await access.visiblePaths( 'me', query ), builder };
        };

        it( 'orders official, mine, my organizations, then community', async () => {
            const { paths } = await listWith();

            expect( paths.map( ( p ) => p.id ) ).toEqual( [ 'official', 'mine', 'group', 'community' ] );
        } );

        it( 'filters by source', async () => {
            const { paths } = await listWith( { source: PathSource.Community } );

            expect( paths.map( ( p ) => p.id ) ).toEqual( [ 'community' ] );
        } );

        it( 'shows the creator\'s name but never their email, and no creator for official paths', async () => {
            const { paths } = await listWith();

            expect( paths.find( ( p ) => p.id === 'official' ) ).toMatchObject( { organization: null, createdBy: null } );
            expect( paths.find( ( p ) => p.id === 'community' )?.createdBy ).toEqual( { id: 'creator', firstName: 'Ann', lastName: 'Lee' } );
        } );

        it( 'escapes LIKE wildcards in the search', async () => {
            const { builder } = await listWith( { search: '50%' } );

            expect( builder.andWhere ).toHaveBeenCalledWith( 'path.title ILIKE :search', { search: '%50\\%%' } );
        } );
    } );

    it( 'visiblePaths asks the database for published paths that are official, public, or in one of my organizations', async () => {
        const builder = fakeQueryBuilder( [] );

        db.repo( LearningPath ).createQueryBuilder.mockReturnValue( builder );
        await access.visiblePaths( 'me' );

        const brackets = builder.andWhere.mock.calls[0]?.[0] as Brackets;
        const conditions = fakeQueryBuilder();

        brackets.whereFactory( conditions as never );

        expect( builder.where ).toHaveBeenCalledWith( 'path.status = :published', { published: CatalogStatus.Published } );
        expect( conditions.where ).toHaveBeenCalledWith( 'path.organization_id IS NULL' );
        expect( conditions.orWhere ).toHaveBeenCalledWith( 'path.visibility = :public', { public: PathVisibility.Public } );
        expect( conditions.orWhere ).toHaveBeenCalledWith( expect.stringContaining( 'FROM memberships WHERE user_id = :userId' ), { userId: 'me' } );
    } );

    it( 'originOfPath gives the organization and creator (names only) of a path', async () => {
        db.repo( LearningPath ).findOneOrFail.mockResolvedValue( {
            organization: { id: 'ws', name: 'Ann\'s Workspace', isPersonal: true, slug: 'x' },
            createdBy: null,
        } );

        expect( await access.originOfPath( 'p' ) ).toEqual( {
            organization: { id: 'ws', name: 'Ann\'s Workspace', isPersonal: true },
            createdBy: null,
        } );
    } );
} );
