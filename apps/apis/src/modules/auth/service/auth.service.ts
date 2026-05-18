import { UserEmailOtpEntity, UserEntity } from '@gradiaqo/nestjs-database/entities';
import { InjectInngestService } from '@gradiaqo/nestjs-inngest';
import { KeycloakUserService } from '@gradiaqo/nestjs-keycloak-admin';
import { UserAuthStatus } from '@gradiaqo/nestjs-shared';
import type { MinionInngestClient } from '@gradiaqo/nestjs-shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import type { Static } from 'typebox';
import { DataSource } from 'typeorm';
import { ResendOtpRequest, SignupRequest, SignupResponse, VerifyOtpRequest, VerifyOtpResponse } from '../dtos';

@Injectable()
export class AuthService {
    constructor(
        @InjectInngestService() private readonly inngestService: MinionInngestClient,
        @InjectDataSource() private readonly datasource: DataSource,
        private readonly keycloakUserService: KeycloakUserService
    ) {}

    async signup( signupDto: Static<typeof SignupRequest> ): Promise<Static<typeof SignupResponse>> {
        const userRepository = this.datasource.getRepository( UserEntity );
        const existingUser = await userRepository.existsBy( {
            email: signupDto.email,
        } );

        if ( existingUser ) {
            throw new ConflictException( 'User with this email already exists.' );
        }

        const keycloakUser = await this.keycloakUserService.createUser( {
            email: signupDto.email,
            password: signupDto.password,
            firstName: signupDto.firstName,
            lastName: signupDto.lastName,
        } );

        let user: UserEntity;
        try {
            user = await userRepository.save(
                userRepository.create( {
                    email: signupDto.email,
                    keycloakId: keycloakUser.id,
                    firstName: signupDto.firstName,
                    lastName: signupDto.lastName,
                    authStatus: UserAuthStatus.PENDING,
                    isActive: false
                } )
            );
        } catch ( error ) {
            await this.keycloakUserService.deleteUser( keycloakUser.id );
            throw error;
        }

        await this.inngestService.send( {
            name: 'users/user.created',
            data: {
                id: user.id,
                email: user.email,
            },
        } );

        return this.toAuthResponse( user, {
            firstName: signupDto.firstName,
            lastName: signupDto.lastName,
        } );
    }

    async verifyOtp( verifyOtpDto: Static<typeof VerifyOtpRequest> ): Promise<Static<typeof VerifyOtpResponse>> {
        const userRepository = this.datasource.getRepository( UserEntity );
        const userEmailOtpRepository = this.datasource.getRepository( UserEmailOtpEntity );

        const user = await userRepository.findOneBy( {
            id: verifyOtpDto.userId,
        } );

        if ( !user ) {
            throw new NotFoundException( 'User not found.' );
        }

        if ( user.authStatus === UserAuthStatus.ACTIVE ) {
            return this.toAuthResponse( user );
        }

        const otpRecord = await userEmailOtpRepository.findOneBy( {
            userId: verifyOtpDto.userId,
        } );

        if ( !otpRecord ) {
            throw new BadRequestException( 'OTP not found or already used.' );
        }

        if ( otpRecord.email !== user.email ) {
            throw new BadRequestException( 'OTP does not match this user.' );
        }

        if ( otpRecord.expiresAt.getTime() <= Date.now() ) {
            await userEmailOtpRepository.delete( { userId: verifyOtpDto.userId } );
            throw new BadRequestException( 'OTP has expired.' );
        }

        const otpHash = this.hashOtp( verifyOtpDto.userId, verifyOtpDto.otp );
        if ( !this.matchesOtpHash( otpRecord.codeHash, otpHash ) ) {
            throw new BadRequestException( 'Invalid OTP.' );
        }

        await this.keycloakUserService.verifyEmail( user.keycloakId );

        user.authStatus = UserAuthStatus.ACTIVE;
        user.isActive = true;
        await userRepository.save( user );
        await userEmailOtpRepository.delete( { userId: verifyOtpDto.userId } );

        return this.toAuthResponse( user );
    }

    async resendOtp( resendOtpDto: Static<typeof ResendOtpRequest> ): Promise<Static<typeof SignupResponse>> {
        const userRepository = this.datasource.getRepository( UserEntity );
        const user = await userRepository.findOneBy( {
            id: resendOtpDto.userId,
        } );

        if ( !user ) {
            throw new NotFoundException( 'User not found.' );
        }

        if ( user.authStatus === UserAuthStatus.ACTIVE ) {
            throw new BadRequestException( 'User is already verified.' );
        }

        await this.inngestService.send( {
            name: 'users/user.otp-resend-requested',
            data: {
                id: user.id,
                email: user.email,
            },
        } );

        return this.toAuthResponse( user );
    }

    private toAuthResponse(
        user: UserEntity,
        fallback?: { firstName?: string; lastName?: string }
    ): Static<typeof SignupResponse> {
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName ?? fallback?.firstName ?? '',
            lastName: user.lastName ?? fallback?.lastName ?? '',
            authStatus: user.authStatus,
        };
    }

    private hashOtp( userId: string, otp: string ) {
        return createHash( 'sha256' )
            .update( `${userId}:${otp}` )
            .digest( 'hex' );
    }

    private matchesOtpHash( storedHash: string, receivedHash: string ) {
        if ( storedHash.length !== receivedHash.length ) {
            return false;
        }

        return timingSafeEqual(
            Buffer.from( storedHash, 'hex' ),
            Buffer.from( receivedHash, 'hex' ),
        );
    }
}
