import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';
import logger from '../utils/logger';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { normalizeUniversity, normalizeCareer } from '../utils/normalizer';

const authService = new AuthService();
import { rabbitmqService } from '../services/rabbitmq.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  roleName: z.enum(['ALUMNO', 'PROFESOR', 'ADMINISTRADOR']),
  username: z.string().optional(),
  fullName: z.string().optional(),
  profilePicture: z.string().url().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  fcmToken: z.string().optional(),
});

const googleLoginSchema = z.object({
  authCode: z.string(),
  fcmToken: z.string().optional(),
});

const recoverPasswordSchema = z.object({
  email: z.string().email(),
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const user = await authService.register(validatedData);
      res.status(201).json({ message: 'User created successfully', user });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const data = await authService.login(validatedData.email, validatedData.password);
      
      if (validatedData.fcmToken && data.user) {
        rabbitmqService.publishDeviceRegistered(data.user.id, validatedData.fcmToken);
      }
      
      if (data.user) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await prisma.activityLog.create({
            data: {
                userId: data.user.id,
                action: 'LOGIN',
                detail: 'Acceso a la plataforma',
                ipAddress: Array.isArray(ip) ? ip[0] : ip
            }
        });
      }

      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async googleLogin(req: Request, res: Response) {
    try {
      const validatedData = googleLoginSchema.parse(req.body);
      const data = await authService.googleLogin(validatedData.authCode);

      if (validatedData.fcmToken && data.user) {
        rabbitmqService.publishDeviceRegistered(data.user.id, validatedData.fcmToken);
      }

      if (data.user) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await prisma.activityLog.create({
            data: {
                userId: data.user.id,
                action: 'LOGIN',
                detail: 'Acceso a la plataforma vía Google',
                ipAddress: Array.isArray(ip) ? ip[0] : ip
            }
        });
      }

      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async me(req: Request, res: Response) {
      try {
          const user = (req as any).user;
          const fullUser = await prisma.user.findUnique({
              where: { id: user.id },
              include: { role: true }
          });
          if (!fullUser) {
              res.status(404).json({ error: 'User not found' });
              return;
          }
          res.status(200).json({ 
              user: {
                  id: fullUser.id,
                  email: fullUser.email,
                  name: fullUser.full_name,
                  photoUrl: fullUser.profile_picture,
                  role: fullUser.role.name
              }
          });
      } catch (error: any) {
          res.status(500).json({ error: error.message });
      }
  }

  async getCompleteProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const profile = await authService.getCompleteProfile(user.id);
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const { fcmToken } = req.body;
      const user = (req as any).user;

      if (user && fcmToken) {
        rabbitmqService.publishDeviceUnregistered(user.id, fcmToken);
      }
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async recoverPassword(req: Request, res: Response) {
    try {
      const validatedData = recoverPasswordSchema.parse(req.body);
      
      const securePin = crypto.randomInt(100000, 999999).toString();

      rabbitmqService.publishPasswordRecovery("user-id", validatedData.email, securePin);

      res.status(200).json({ 
        message: 'Si el correo existe, se ha enviado un PIN de recuperación.',
        _test_pin: securePin 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async completeStudentProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const { full_name, enrollment_id, university_id, career_id, period_number, skills } = req.body;

      let finalUniversityId = university_id;
      let finalCareerId = career_id;

      // Resolver ID de Universidad por nombre (o crearla)
      if (university_id && !university_id.includes('-')) {
        const normUniv = normalizeUniversity(university_id);
        let uni = await prisma.university.findFirst({
          where: { name: { equals: normUniv, mode: 'insensitive' } }
        });
        if (!uni) {
          uni = await prisma.university.create({
            data: { name: normUniv }
          });
        }
        finalUniversityId = uni.id;
      }

      // Resolver ID de Carrera por nombre
      if (career_id && !career_id.includes('-')) {
        const normCareer = normalizeCareer(career_id);
        let car = await prisma.career.findFirst({
          where: { name: { equals: normCareer, mode: 'insensitive' } }
        });
        if (!car) {
          car = await prisma.career.create({
            data: { name: normCareer, normalized_name: normCareer.toLowerCase().trim() }
          });
        }
        finalCareerId = car.id;
      }

      // Actualizar el usuario con nombre, matricula, universidad, carrera y cuatrimestre
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          full_name,
          enrollment_id,
          universityId: finalUniversityId,
          careerId: finalCareerId,
          semester: period_number ? String(period_number) : null,
        },
      });

      // Si se enviaron skills, actualizamos las habilidades del usuario
      if (skills && Array.isArray(skills)) {
        // Borrar habilidades anteriores (por si acaso)
        await prisma.userSkill.deleteMany({
          where: { userId: user.id },
        });

        // Buscar los IDs de los skills por su nombre
        const skillRecords = await prisma.skill.findMany({
          where: {
            name: {
              in: skills,
            },
          },
        });

        // Crear la relacion en UserSkill
        for (const skill of skillRecords) {
          await prisma.userSkill.create({
            data: {
              userId: user.id,
              skillId: skill.id,
            },
          });
        }
      }

      res.status(200).json({ message: 'Perfil completado exitosamente', user: updatedUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProfilePicture(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const { imageBase64 } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: 'No image provided' });
        return;
      }

      // Configure Cloudinary using user's credentials
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: 'zpqp1swt',
        api_key: '594268643178644',
        api_secret: 'q-zoYZBI_Oblx72m7YlTM16KLTQ',
      });

      // Upload image to Cloudinary (base64 string can be passed directly if it includes data:image/... base64,)
      // If it doesn't have the prefix, we assume it's jpeg
      let uploadStr = imageBase64;
      if (!uploadStr.startsWith('data:image')) {
          uploadStr = `data:image/jpeg;base64,${uploadStr}`;
      }

      const result = await cloudinary.uploader.upload(uploadStr, {
          folder: 'corvus_profiles',
          public_id: user.id, // Overwrite previous picture if any
          overwrite: true,
          transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' } // optimize for profile
          ]
      });

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { profile_picture: result.secure_url },
      });

      res.status(200).json({ message: 'Profile picture updated', profile_picture: result.secure_url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const { full_name, enrollment_id, semester, skills } = req.body;

      // Actualizar el usuario
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          full_name,
          enrollment_id,
          semester: semester ? String(semester) : null,
        },
      });

      // Actualizar skills
      if (skills && Array.isArray(skills)) {
        await prisma.userSkill.deleteMany({
          where: { userId: user.id },
        });

        const skillRecords = await prisma.skill.findMany({
          where: {
            name: {
              in: skills,
            },
          },
        });

        for (const skill of skillRecords) {
          await prisma.userSkill.create({
            data: {
              userId: user.id,
              skillId: skill.id,
            },
          });
        }
        
        // Publicar evento a RabbitMQ para que otros servicios se sincronicen
        const { rabbitmqService } = require('../services/rabbitmq.service');
        await rabbitmqService.publishProfileUpdated(user.id, { skills });
      }

      res.status(200).json({ message: 'Perfil actualizado exitosamente', user: updatedUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async requestEmailVerification(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      // Generate a 6-digit random code
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration to 15 minutes from now
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verification_code: pin,
          verification_expires_at: expiresAt,
        },
      });

      const { rabbitmqService } = require('../services/rabbitmq.service');
      await rabbitmqService.publishEmailVerification(user.id, user.email, pin);

      res.status(200).json({ message: 'Código de verificación enviado' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async confirmEmailVerification(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const { code } = req.body;
      if (!code) {
        res.status(400).json({ error: 'Código no proporcionado' });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser || dbUser.verification_code !== code) {
        res.status(400).json({ error: 'Código incorrecto' });
        return;
      }

      if (dbUser.verification_expires_at && new Date() > dbUser.verification_expires_at) {
        res.status(400).json({ error: 'El código ha expirado' });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          is_verified: true,
          verification_code: null,
          verification_expires_at: null,
        },
      });

      res.status(200).json({ message: 'Correo verificado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteAccount(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      // La eliminación en cascada de Prisma se encargará de borrar:
      // - user_skills
      // - linked_folders
      // - llm_sessions
      // - requests (a través de la DB si es que está configurado cascade)
      // Y establecerá en NULL el userId en activity_logs
      
      await prisma.user.delete({
        where: { id: user.id },
      });

      res.status(200).json({ message: 'Cuenta eliminada exitosamente. Tu historial ha sido anonimizado.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

