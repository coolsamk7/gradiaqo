import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResendOtpRequest, SignupRequest, SignupResponse, VerifyOtpRequest, VerifyOtpResponse } from '../dtos';
import type { Static } from 'typebox';
import { TypeApiBody, TypeApiResponse } from 'src/decorators';
import { Public } from 'src/guards/public.guard';
import { AuthService } from '../service';

@ApiTags( 'Auth' )
@Controller( { path: 'auth', version: '1' } )
export class AuthController {
    constructor( private readonly authService: AuthService ) {}

    @Post( 'sigup' )
    @TypeApiBody( { schema: SignupRequest } )
    @Public()
    @TypeApiResponse( { schema: SignupResponse, status: 200 } )
    async singup( @Body() signupDto: Static<typeof SignupRequest> ): Promise<Static<typeof SignupResponse>> {
        return this.authService.signup( signupDto );
    }

    @Post( 'resend-otp' )
    @TypeApiBody( { schema: ResendOtpRequest } )
    @Public()
    @TypeApiResponse( { schema: SignupResponse, status: 200 } )
    async resendOtp( @Body() resendOtpDto: Static<typeof ResendOtpRequest> ): Promise<Static<typeof SignupResponse>> {
        return this.authService.resendOtp( resendOtpDto );
    }

    @Post( 'verify-otp' )
    @TypeApiBody( { schema: VerifyOtpRequest } )
    @Public()
    @TypeApiResponse( { schema: VerifyOtpResponse, status: 200 } )
    async verifyOtp( @Body() verifyOtpDto: Static<typeof VerifyOtpRequest> ): Promise<Static<typeof VerifyOtpResponse>> {
        return this.authService.verifyOtp( verifyOtpDto );
    }
}
