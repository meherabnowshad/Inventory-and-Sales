import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  usernameOrEmail?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  getIdentifier(): string {
    const raw = this.usernameOrEmail ?? this.username ?? '';
    return raw.trim();
  }
}
