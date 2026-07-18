import { Body, Controller, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { IsIn } from 'class-validator';
import { AccountService } from './account.service';

class SignupRoleDto {
  /** Public signup may only choose customer (user) or agent — never admin. */
  @IsIn(['user', 'agent'])
  role: 'user' | 'agent';
}

@Controller('api/account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('signup-role')
  setSignupRole(@Body() dto: SignupRoleDto, @Session() session: UserSession) {
    return this.accountService.setSignupRole(session.user.id, dto.role);
  }
}
