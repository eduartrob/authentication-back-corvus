import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  ''
);
export class AuthService {
  async register(data: any) {
    try {
      const { email, password, roleName, username, fullName, profilePicture } = data;

      // -# find or create role
      let role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({ data: { name: roleName } });
      }

      // -# check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new Error('User already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password_hash: hashedPassword,
          roleId: role.id,
          username: username || null,
          full_name: fullName || null,
          profile_picture: profilePicture || null,
        },
      });

      return { id: user.id, email: user.email, role: role.name };
    } catch (error) {
      logger.error('Error in AuthService.register', error);
      throw error;
    }
  }

  async login(email: string, password: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      const token = jwt.sign(
        { id: user.id, role: user.role.name },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any }
      );

      return { token, user: { id: user.id, email: user.email, role: user.role.name } };
    } catch (error) {
      logger.error('Error in AuthService.login', error);
      throw error;
    }
  }

  async googleLogin(authCode: string) {
    try {
      let email = '';
      let fullName = '';
      let profilePicture = '';
      let refreshToken = null;
      let accessToken = null;

      if (process.env.NODE_ENV === 'development' && !process.env.GOOGLE_CLIENT_ID) {
        // -# mock para desarrollo
        const decoded: any = jwt.decode(authCode);
        if (!decoded || !decoded.email) throw new Error('Token inválido en desarrollo');
        email = decoded.email;
        fullName = decoded.name || '';
        profilePicture = decoded.picture || '';
      } else {
        // -# 1 intercambiar el authcode por tokens access token y refresh token
        const { tokens } = await googleClient.getToken(authCode);
        
        refreshToken = tokens.refresh_token || null;
        accessToken = tokens.access_token || null;

        // -# 2 extraer la identidad del idtoken que viene en la respuesta
        const ticket = await googleClient.verifyIdToken({
          idToken: tokens.id_token!,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        
        if (!payload || !payload.email) {
          throw new Error('Google token payload inválido');
        }

        email = payload.email;
        fullName = payload.name || '';
        profilePicture = payload.picture || '';
      }

      // -# validar el dominio del correo institucional o las cuentas especificas de pruebas de google
      let roleName = '';
      const emailLower = email.toLowerCase();
      
      if (
        emailLower === 'eduartrob2@gmail.com' ||
        emailLower === 'thegreatteachertester@gmail.com' ||
        emailLower.endsWith('@upchiapas.edu.mx')
      ) {
        roleName = 'PROFESOR';
      } else if (
        emailLower === 'testeralumnos@gmail.com' ||
        emailLower === 'eduartrob3@gmail.com' ||
        emailLower.endsWith('@ids.upchiapas.edu.mx')
      ) {
        roleName = 'ALUMNO';
      } else {
        throw new Error('Dominio de correo no permitido. Solo se aceptan correos institucionales de la universidad.');
      }

      // -# buscar si el rol existe si no crearlo
      let role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({ data: { name: roleName } });
      }

      // -# buscar al usuario
      let user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });

      if (!user) {
        // -# generamos un password aleatorio seguro ya que entrara solo por google auth
        const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = await prisma.user.create({
          data: {
            email,
            password_hash: hashedPassword,
            roleId: role.id,
            full_name: fullName || null,
            profile_picture: profilePicture || null,
            google_access_token: accessToken,
            google_refresh_token: refreshToken
          },
          include: { role: true }
        });
      } else {
        const updateData: any = {
          full_name: fullName || user.full_name,
          profile_picture: profilePicture || user.profile_picture,
          google_access_token: accessToken || user.google_access_token
        };
        if (refreshToken) {
          updateData.google_refresh_token = refreshToken;
        }

        user = await prisma.user.update({
          where: { email },
          data: updateData,
          include: { role: true }
        });
      }

      // -# generar jwt de nuestra aplicacion
      const token = jwt.sign(
        { id: user.id, role: user.role.name },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any }
      );

      return { 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role.name, 
          fullName: user.full_name, 
          profilePicture: user.profile_picture 
        } 
      };
    } catch (error) {
      logger.error('Error in AuthService.googleLogin', error);
      throw error;
    }
  }
}
