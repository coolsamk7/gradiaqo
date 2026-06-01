import Type from 'typebox';
import { transformTypeboxValue } from 'src/utils/transform-typebox-response.util';

describe( 'transformTypeboxValue', () => {
    it( 'converts compatible values and strips unknown object properties', () => {
        const schema = Type.Object( {
            id: Type.String(),
            count: Type.Number(),
        } );

        expect( transformTypeboxValue( schema, {
            id: 123,
            count: '42',
            ignored: true,
        } ) ).toEqual( {
            id: '123',
            count: 42,
        } );
    } );

    it( 'throws when the value cannot satisfy the schema', () => {
        const schema = Type.Object( {
            email: Type.String( { format: 'email' } ),
        } );

        expect( () => transformTypeboxValue( schema, {
            email: 'not-an-email',
        } ) ).toThrow();
    } );
} );
