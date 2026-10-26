import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@studylog/database';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
    constructor( @InjectRepository( User ) private readonly users: Repository<User> ) {}

    findById( id: string ): Promise<User | null> {
        return this.users.findOneBy( { id } );
    }

    /** For routes where the access token's user must still exist. */
    async findByIdOrFail( id: string ): Promise<User> {
        const user = await this.findById( id );

        if ( !user ) {
            throw new UnauthorizedException();
        }

        return user;
    }

    findByIdWithPassword( id: string ): Promise<User | null> {
        return this.users
            .createQueryBuilder( 'user' )
            .addSelect( 'user.passwordHash' )
            .where( 'user.id = :id', { id } )
            .getOne();
    }

    findByEmailWithPassword( email: string ): Promise<User | null> {
        return this.users
            .createQueryBuilder( 'user' )
            .addSelect( 'user.passwordHash' )
            .where( 'user.email = :email', { email } )
            .getOne();
    }

    /** Records that the user is using the app now (at login and on every token refresh). */
    async markActive( id: string ): Promise<void> {
        await this.users.update( { id }, { lastActiveAt: new Date() } );
    }

    existsByEmail( email: string ): Promise<boolean> {
        return this.users.existsBy( { email } );
    }

    /** Pass `manager` to run inside a transaction. */
    create(
        data: Pick<User, 'email' | 'firstName' | 'lastName' | 'passwordHash' | 'platformRole'>,
        manager?: EntityManager,
    ): Promise<User> {
        const users = manager?.getRepository( User ) ?? this.users;

        return users.save( users.create( data ) );
    }
}
