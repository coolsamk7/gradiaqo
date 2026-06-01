import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { UserEmailOtpEntity, UserEntity } from '@gradiaqo/nestjs-database/entities';
import { INNGEST_KEY } from '@gradiaqo/nestjs-inngest';
import { KeycloakUserService } from '@gradiaqo/nestjs-keycloak-admin';
import { UserAuthStatus } from '@gradiaqo/nestjs-shared';
import { AuthService } from 'src/modules/auth/service/auth.service';

type RepositoryMock = {
    existsBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    delete: jest.Mock;
};

function createRepositoryMock(): RepositoryMock {
    return {
        existsBy: jest.fn(),
        create: jest.fn( ( value ) => value ),
        save: jest.fn( ( value ) => Promise.resolve( { id: 'user_1', ...value } ) ),
        findOneBy: jest.fn(),
        delete: jest.fn(),
    };
}

async function createService() {
    const userRepository = createRepositoryMock();
    const otpRepository = createRepositoryMock();
    const datasource = {
        getRepository: jest.fn( ( entity ) => {
            if ( entity === UserEntity ) {
                return userRepository;
            }

            if ( entity === UserEmailOtpEntity ) {
                return otpRepository;
            }

            throw new Error( 'Unexpected repository.' );
        } ),
    };
    const inngestService = {
        send: jest.fn(),
    };
    const keycloakUserService = {
        createUser: jest.fn().mockResolvedValue( { id: 'kc_1' } ),
        deleteUser: jest.fn(),
        verifyEmail: jest.fn(),
    };

    const module = await Test.createTestingModule( {
        providers: [
            AuthService,
            {
                provide: INNGEST_KEY,
                useValue: inngestService,
            },
            {
                provide: getDataSourceToken(),
                useValue: datasource,
            },
            {
                provide: KeycloakUserService,
                useValue: keycloakUserService,
            },
        ],
    } ).compile();

    return {
        service: module.get( AuthService ),
        userRepository,
        otpRepository,
        inngestService,
        keycloakUserService,
    };
}

describe( 'AuthService', () => {
    describe( 'signup', () => {
        const signupDto = {
            email: 'sameer@example.com',
            password: 'password123',
            firstName: 'Sameer',
            lastName: 'Khan',
        };

        it( 'rejects duplicate emails before creating a Keycloak user', async () => {
            const { service, userRepository, keycloakUserService } = await createService();
            userRepository.existsBy.mockResolvedValue( true );

            await expect( service.signup( signupDto ) ).rejects.toBeInstanceOf( ConflictException );
            expect( keycloakUserService.createUser ).not.toHaveBeenCalled();
        } );

        it( 'creates a pending local user and emits a user.created event', async () => {
            const { service, userRepository, inngestService, keycloakUserService } = await createService();
            userRepository.existsBy.mockResolvedValue( false );

            await expect( service.signup( signupDto ) ).resolves.toEqual( {
                id: 'user_1',
                email: signupDto.email,
                firstName: signupDto.firstName,
                lastName: signupDto.lastName,
                authStatus: UserAuthStatus.PENDING,
            } );
            expect( keycloakUserService.createUser ).toHaveBeenCalledWith( signupDto );
            expect( userRepository.save ).toHaveBeenCalledWith( expect.objectContaining( {
                email: signupDto.email,
                keycloakId: 'kc_1',
                authStatus: UserAuthStatus.PENDING,
                isActive: false,
            } ) );
            expect( inngestService.send ).toHaveBeenCalledWith( {
                name: 'users/user.created',
                data: {
                    id: 'user_1',
                    email: signupDto.email,
                },
            } );
        } );

        it( 'deletes the Keycloak user when local persistence fails', async () => {
            const { service, userRepository, keycloakUserService } = await createService();
            const error = new Error( 'database failed' );
            userRepository.existsBy.mockResolvedValue( false );
            userRepository.save.mockRejectedValue( error );

            await expect( service.signup( signupDto ) ).rejects.toThrow( error );
            expect( keycloakUserService.deleteUser ).toHaveBeenCalledWith( 'kc_1' );
        } );
    } );

    describe( 'verifyOtp', () => {
        it( 'rejects missing users', async () => {
            const { service, userRepository } = await createService();
            userRepository.findOneBy.mockResolvedValue( null );

            await expect( service.verifyOtp( {
                userId: 'user_1',
                otp: '123456',
            } ) ).rejects.toBeInstanceOf( NotFoundException );
        } );

        it( 'rejects invalid OTP codes', async () => {
            const { service, userRepository, otpRepository } = await createService();
            userRepository.findOneBy.mockResolvedValue( {
                id: 'user_1',
                email: 'sameer@example.com',
                authStatus: UserAuthStatus.PENDING,
            } );
            otpRepository.findOneBy.mockResolvedValue( {
                userId: 'user_1',
                email: 'sameer@example.com',
                codeHash: '0'.repeat( 64 ),
                expiresAt: new Date( Date.now() + 60_000 ),
            } );

            await expect( service.verifyOtp( {
                userId: 'user_1',
                otp: '123456',
            } ) ).rejects.toBeInstanceOf( BadRequestException );
        } );

        it( 'activates the local and Keycloak user for a valid OTP', async () => {
            const { service, userRepository, otpRepository, keycloakUserService } = await createService();
            const user = {
                id: 'user_1',
                email: 'sameer@example.com',
                firstName: 'Sameer',
                lastName: 'Khan',
                keycloakId: 'kc_1',
                authStatus: UserAuthStatus.PENDING,
                isActive: false,
            };
            userRepository.findOneBy.mockResolvedValue( user );
            otpRepository.findOneBy.mockResolvedValue( {
                userId: 'user_1',
                email: 'sameer@example.com',
                codeHash: '5129345ffe097d82fc2092978b67fc4c905f1a008a89fd18ed57eb0645101421',
                expiresAt: new Date( Date.now() + 60_000 ),
            } );

            await expect( service.verifyOtp( {
                userId: 'user_1',
                otp: '123456',
            } ) ).resolves.toEqual( {
                id: 'user_1',
                email: 'sameer@example.com',
                firstName: 'Sameer',
                lastName: 'Khan',
                authStatus: UserAuthStatus.ACTIVE,
            } );
            expect( keycloakUserService.verifyEmail ).toHaveBeenCalledWith( 'kc_1' );
            expect( userRepository.save ).toHaveBeenCalledWith( expect.objectContaining( {
                authStatus: UserAuthStatus.ACTIVE,
                isActive: true,
            } ) );
            expect( otpRepository.delete ).toHaveBeenCalledWith( { userId: 'user_1' } );
        } );
    } );

    describe( 'resendOtp', () => {
        it( 'always returns accepted and emits resend only for matching pending users', async () => {
            const { service, userRepository, inngestService } = await createService();
            userRepository.findOneBy.mockResolvedValue( {
                id: 'user_1',
                email: 'sameer@example.com',
                authStatus: UserAuthStatus.PENDING,
            } );

            await expect( service.resendOtp( {
                userId: 'user_1',
                email: 'Sameer@Example.com',
            } ) ).resolves.toEqual( { accepted: true } );
            expect( inngestService.send ).toHaveBeenCalledWith( {
                name: 'users/user.otp-resend-requested',
                data: {
                    id: 'user_1',
                    email: 'sameer@example.com',
                },
            } );
        } );

        it( 'does not reveal whether an unmatched resend request found a user', async () => {
            const { service, userRepository, inngestService } = await createService();
            userRepository.findOneBy.mockResolvedValue( null );

            await expect( service.resendOtp( {
                userId: 'missing',
                email: 'sameer@example.com',
            } ) ).resolves.toEqual( { accepted: true } );
            expect( inngestService.send ).not.toHaveBeenCalled();
        } );
    } );
} );
