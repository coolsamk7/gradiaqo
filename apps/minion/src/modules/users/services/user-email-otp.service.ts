import { UserEmailOtpEntity } from '@gradiaqo/nestjs-database/entities';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { Repository } from 'typeorm';

type IssueOtpArgs = {
    userId: string;
    email: string;
};

@Injectable()
export class UserEmailOtpService {
    constructor(
        @InjectRepository( UserEmailOtpEntity )
        private readonly userEmailOtpRepository: Repository<UserEmailOtpEntity>,
    ) {}

    async issueOtp( { userId, email }: IssueOtpArgs ) {
        const otp = randomInt( 0, 1_000_000 ).toString().padStart( 6, '0' );
        const expiresAt = new Date( Date.now() + 10 * 60 * 1000 );

        await this.userEmailOtpRepository.delete( { userId } );
        await this.userEmailOtpRepository.save(
            this.userEmailOtpRepository.create( {
                userId,
                email,
                codeHash: this.hashOtp( userId, otp ),
                expiresAt,
            } )
        );

        return {
            otp,
            expiresAt,
        };
    }

    private hashOtp( userId: string, otp: string ) {
        return createHash( 'sha256' )
            .update( `${userId}:${otp}` )
            .digest( 'hex' );
    }
}
