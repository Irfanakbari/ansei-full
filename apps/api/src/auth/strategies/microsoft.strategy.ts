import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { MicrosoftStrategyOptions } from 'passport-microsoft';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(private prisma: PrismaService) {
    // Validate required environment variables
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const callbackUrl = process.env.AZURE_AD_CALLBACK_URL;
    const tenantId = process.env.AZURE_AD_TENANT_ID;

    if (!clientId || !clientSecret || !callbackUrl || !tenantId) {
      throw new Error(
        'Missing required Azure AD environment variables: ' +
          'AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_CALLBACK_URL, AZURE_AD_TENANT_ID',
      );
    }

    const options: MicrosoftStrategyOptions = {
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: callbackUrl,
      scope: ['user.read'],
      tenant: tenantId,
    };

    super(options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ) {
    // Ekstrak email dan ID SSO dari payload Microsoft
    const email = profile.emails[0].value;
    const ssoId = profile.id;

    // Cari user di database berdasarkan Email
    const user = await this.prisma.mTCUserManagement.findUnique({
      where: { Email: email },
    });

    // 1. Tolak akses jika email belum didaftarkan oleh admin/HR
    if (!user) {
      return done(
        new UnauthorizedException(
          'Akun belum terdaftar di sistem. Silakan hubungi admin.',
        ),
        false,
      );
    }

    // 2. Tolak akses jika akun sudah ada tetapi statusnya tidak aktif
    if (!user.IsActive) {
      return done(
        new UnauthorizedException('Akun Anda telah dinonaktifkan.'),
        false,
      );
    }

    // 3. (Opsional) Tautkan akun lokal dengan ID Microsoft jika belum tertaut
    if (!user.SsoObjectId) {
      await this.prisma.mTCUserManagement.update({
        where: { Id: user.Id },
        data: { SsoObjectId: ssoId, AuthProvider: 'SSO' },
      });
    }

    // Jika semua lolos, teruskan data user ke tahapan selanjutnya (controller)
    done(null, user);
  }
}
