import { Injectable } from '@nestjs/common';
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

    findByEmailWithPassword( email: string ): Promise<User | null> {
        return this.users
            .createQueryBuilder( 'user' )
            .addSelect( 'user.passwordHash' )
            .where( 'user.email = :email', { email } )
            .getOne();
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
