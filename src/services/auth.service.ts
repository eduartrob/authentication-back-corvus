import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  '' // Usar string vacío para serverAuthCodes generados desde Android/iOS
);
export class AuthService {
  async register(data: any) {
    try {
      const { email, password, roleName, username, fullName, profilePicture } = data;

      // Find or create role
      let role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({ data: { name: roleName } });
      }

      // Check if user exists
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
        // MOCK PARA DESARROLLO
        const decoded: any = jwt.decode(authCode); // asumiendo que en dev mandan un jwt falso
        if (!decoded || !decoded.email) throw new Error('Token inválido en desarrollo');
        email = decoded.email;
        fullName = decoded.name || '';
        profilePicture = decoded.picture || '';
      } else {
        // 1. Intercambiar el authCode por tokens (Access Token y Refresh Token)
        const { tokens } = await googleClient.getToken(authCode);
        
        refreshToken = tokens.refresh_token || null;
        accessToken = tokens.access_token || null;

        // 2. Extraer la identidad del id_token que viene en la respuesta
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

      // Validar el dominio del correo institucional
      let roleName = '';
      if (email.endsWith('@ids.upchiapas.edu.mx')) {
        roleName = 'ALUMNO';
      } else if (email.endsWith('@upchiapas.edu.mx')) {
        roleName = 'PROFESOR';
      } else {
        throw new Error('Dominio de correo no permitido. Solo se aceptan correos institucionales de la universidad.');
      }

      // Buscar si el rol existe, si no crearlo
      let role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({ data: { name: roleName } });
      }

      // Buscar al usuario
      let user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });

      // Si no existe, lo registramos automáticamente
      if (!user) {
        // Generamos un password aleatorio seguro ya que entrará solo por Google Auth
        const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = await prisma.user.create({
          data: {
            email,
            password_hash: hashedPassword,
            roleId: role.id,
            full_name: fullName || null,
            profile_picture: profilePicture || null
          },
          include: { role: true }
        });
      } else {
        // Si ya existe pero cambió de foto o nombre en Google, actualizamos
        // IMPORTANTE: Solo actualizamos el refresh_token si Google nos manda uno nuevo.
        // Si manda null, conservamos el que ya teníamos en la BD.
        user = await prisma.user.update({
          where: { email },
          data: {
            full_name: fullName || user.full_name,
            profile_picture: profilePicture || user.profile_picture
          },
          include: { role: true }
        });
      }

      // Generar JWT de nuestra aplicación
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
