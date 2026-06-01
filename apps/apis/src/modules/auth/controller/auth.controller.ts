import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { ResendOtpRequest, ResendOtpResponse, SignupRequest, SignupResponse, VerifyOtpRequest, VerifyOtpResponse } from '../dtos';
import type { Static } from 'typebox';
import { OtpRateLimit, TypeApiBody, TypeApiResponse } from 'src/decorators';
import { Public } from 'src/guards/public.guard';
import { AuthService } from '../service';

@ApiTags( 'Auth' )
@Controller( { path: 'auth', version: '1' } )
export class AuthController {
    constructor( private readonly authService: AuthService ) {}

    @Post( 'signup' )
    @OtpRateLimit( 'signup' )
    @TypeApiBody( { schema: SignupRequest } )
    @Public()
    @TypeApiResponse( { schema: SignupResponse, status: 200 } )
    async signup( @Body() signupDto: Static<typeof SignupRequest> ): Promise<Static<typeof SignupResponse>> {
        return this.authService.signup( signupDto );
    }

    @Post( 'sigup' )
    @ApiExcludeEndpoint()
    @OtpRateLimit( 'signup' )
    @TypeApiBody( { schema: SignupRequest } )
    @Public()
    @TypeApiResponse( { schema: SignupResponse, status: 200 } )
    async legacySignup( @Body() signupDto: Static<typeof SignupRequest> ): Promise<Static<typeof SignupResponse>> {
        return this.authService.signup( signupDto );
    }

    @Post( 'resend-otp' )
    @HttpCode( 202 )
    @OtpRateLimit( 'resend' )
    @TypeApiBody( { schema: ResendOtpRequest } )
    @Public()
    @TypeApiResponse( { schema: ResendOtpResponse, status: 202 } )
    async resendOtp( @Body() resendOtpDto: Static<typeof ResendOtpRequest> ): Promise<Static<typeof ResendOtpResponse>> {
        return this.authService.resendOtp( resendOtpDto );
    }

    @Post( 'verify-otp' )
    @OtpRateLimit( 'verify' )
    @TypeApiBody( { schema: VerifyOtpRequest } )
    @Public()
    @TypeApiResponse( { schema: VerifyOtpResponse, status: 200 } )
    async verifyOtp( @Body() verifyOtpDto: Static<typeof VerifyOtpRequest> ): Promise<Static<typeof VerifyOtpResponse>> {
        return this.authService.verifyOtp( verifyOtpDto );
    }
}
