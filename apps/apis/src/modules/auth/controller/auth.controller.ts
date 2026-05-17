import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SignupRequest, SignupResponse } from '../dtos';
import type { Static } from 'typebox';
import { Public } from 'src/guards/public.guard';
import { AuthService } from '../service';

@ApiTags( 'Auth' )
@Controller( { path: 'auth', version: '1' } )
export class AuthController {
    constructor( private readonly authService: AuthService ) {}

    @Post( 'sigup' )
    @ApiBody( { schema: SignupRequest } )
    @Public()
    @ApiOkResponse( { schema: SignupResponse } )
    async singup( @Body() signupDto: Static<typeof SignupRequest> ): Promise<Static<typeof SignupResponse>> {
        return this.authService.signup( signupDto );
    }
}
