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
import { AuthRequest } from '../middlewares/auth.middleware';
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  roleName: z.enum(['ALUMNO', 'PROFESOR', 'ADMINISTRADOR']),
  username: z.string().optional(),
  fullName: z.string().optional(),
  profilePicture: z.string().url().optional(),
  googleEmail: z.string().email().optional(),
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

  async linkGoogle(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const validatedData = googleLoginSchema.parse(req.body);
      const data = await authService.linkGoogleAccount(user.id, validatedData.authCode);

      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: (error as any).errors });
         return;
      }
      res.status(400).json({ error: error.message });
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
                  role: fullUser.role.name,
                  universityId: fullUser.universityId,
                  careerId: fullUser.careerId
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
          const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          car = await prisma.career.create({
            data: { name: career_id, normalized_name: normalize(career_id) }
          });
        }
        finalCareerId = car.id;
      }

      // Actualizar el usuario con nombre, matricula, universidad, carrera y cuatrimestre
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          full_name,
          enrollment_id: enrollment_id === "" ? null : enrollment_id,
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
        let skillRecords = await prisma.skill.findMany({
          where: {
            name: {
              in: skills,
            },
          },
        });

        // Create missing skills
        const foundSkillNames = skillRecords.map((s: any) => s.name);
        const missingSkills = skills.filter((s: string) => !foundSkillNames.includes(s));
        
        for (const skillName of missingSkills) {
          const newSkill = await prisma.skill.create({
            data: { 
              name: skillName
            }
          });
          skillRecords.push(newSkill);
        }

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

  async deleteProfilePicture(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: 'zpqp1swt',
        api_key: '594268643178644',
        api_secret: 'q-zoYZBI_Oblx72m7YlTM16KLTQ',
      });

      try {
        await cloudinary.uploader.destroy(`corvus_profiles/${user.id}`);
      } catch (cloudinaryError) {
        console.error('Error deleting photo from Cloudinary:', cloudinaryError);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { profile_picture: null },
      });

      res.status(200).json({ message: 'Foto de perfil eliminada' });
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

      console.log('--- UPDATE PROFILE BODY ---', req.body);

      const { full_name, enrollment_id, semester, skills, careers, university_id } = req.body;

      let dataToUpdate: any = {
        full_name,
        enrollment_id: enrollment_id === "" ? null : enrollment_id,
        semester: semester ? String(semester) : null,
        universityId: university_id || undefined,
      };

      let finalSkills = skills;

      if (careers !== undefined && Array.isArray(careers)) {
        if (careers.length > 0) {
          const mainCareer = careers[0];
          const normCareer = normalizeCareer(mainCareer);
          let car = await prisma.career.findFirst({
            where: { name: { equals: normCareer, mode: 'insensitive' } }
          });
          if (!car) {
            const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            car = await prisma.career.create({
              data: { name: mainCareer, normalized_name: normalize(mainCareer) }
            });
          }
          dataToUpdate.careerId = car.id;
          finalSkills = careers.slice(1);
        } else {
          finalSkills = [];
        }
      }

      // Actualizar el usuario
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: dataToUpdate,
      });

      // Actualizar skills
      if (finalSkills && Array.isArray(finalSkills)) {
        await prisma.userSkill.deleteMany({
          where: { userId: user.id },
        });

        let skillRecords = await prisma.skill.findMany({
          where: {
            OR: finalSkills.map((s: string) => ({
              name: { equals: s, mode: 'insensitive' }
            }))
          },
        });

        // Create missing skills
        const foundSkillNames = skillRecords.map((s: any) => s.name.toLowerCase());
        const missingSkills = finalSkills.filter((s: string) => !foundSkillNames.includes(s.toLowerCase()));
        
        for (const skillName of missingSkills) {
          const newSkill = await prisma.skill.create({
            data: { 
              name: skillName
            }
          });
          skillRecords.push(newSkill);
        }

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
        await rabbitmqService.publishProfileUpdated(user.id, { skills: finalSkills });
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

      const { type } = req.body; // 'primary' | 'secondary'

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser) return;

      const emailToSend = type === 'secondary' ? dbUser.secondary_email : dbUser.email;
      
      if (!emailToSend) {
        res.status(400).json({ error: 'Correo no encontrado' });
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
      await rabbitmqService.publishEmailVerification(user.id, emailToSend, pin);

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

      const { code, type } = req.body;
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

      const isSecondary = type === 'secondary';

      await prisma.user.update({
        where: { id: user.id },
        data: {
          is_verified: isSecondary ? dbUser.is_verified : true,
          secondary_is_verified: isSecondary ? true : dbUser.secondary_is_verified,
          verification_code: null,
          verification_expires_at: null,
        },
      });

      res.status(200).json({ message: 'Correo verificado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async addSecondaryEmail(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'No autorizado' });

      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Falta correo electrónico' });

      // Verificar si el correo ya existe
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email: email }, { secondary_email: email }] }
      });

      if (existing && existing.id !== user.id) {
        return res.status(400).json({ error: 'Este correo ya está en uso' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          secondary_email: email,
          secondary_is_verified: false,
        }
      });

      res.status(200).json({ message: 'Correo secundario agregado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteEmail(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'No autorizado' });

      const { type } = req.body;
      if (!type || (type !== 'primary' && type !== 'secondary')) {
        return res.status(400).json({ error: 'Tipo de correo no válido' });
      }

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (!dbUser.secondary_email) {
        return res.status(400).json({ error: 'No puedes borrar tu único correo.' });
      }

      let dataToUpdate: any = {};

      if (type === 'primary') {
        // Mover secundario a primario
        dataToUpdate.email = dbUser.secondary_email;
        dataToUpdate.is_verified = dbUser.secondary_is_verified;
        dataToUpdate.secondary_email = null;
        dataToUpdate.secondary_is_verified = false;
        
        // Si el primario que estamos borrando era el de Google, lo desvinculamos
        if (dbUser.google_email === dbUser.email) {
          dataToUpdate.google_email = null;
          dataToUpdate.google_access_token = null;
          dataToUpdate.google_refresh_token = null;
        }
      } else {
        dataToUpdate.secondary_email = null;
        dataToUpdate.secondary_is_verified = false;

        // Si el secundario que estamos borrando era el de Google, lo desvinculamos
        if (dbUser.google_email === dbUser.secondary_email) {
          dataToUpdate.google_email = null;
          dataToUpdate.google_access_token = null;
          dataToUpdate.google_refresh_token = null;
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: dataToUpdate
      });

      res.status(200).json({ message: 'Correo borrado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteAccount(req: Request, res: Response) {
    try {
      const userReq = (req as any).user;
      if (!userReq) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }

      // Obtener info completa del usuario
      const dbUser = await prisma.user.findUnique({
        where: { id: userReq.id },
        include: {
          role: true,
          team_members: true,
          project_collaborations: true,
        }
      });

      if (!dbUser) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
      }

      // Delete photo from Cloudinary
      if (dbUser.profile_picture) {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: 'zpqp1swt',
          api_key: '594268643178644',
          api_secret: 'q-zoYZBI_Oblx72m7YlTM16KLTQ',
        });
        try {
          await cloudinary.uploader.destroy(`corvus_profiles/${dbUser.id}`);
        } catch (cloudinaryError) {
          console.error('Error deleting photo during account deletion:', cloudinaryError);
        }
      }

      const roleName = dbUser.role.name;

      if (roleName === 'ALUMNO') {
        for (const tm of dbUser.team_members) {
          if (tm.is_leader) {
            // Reasignar líder
            const nextMember = await prisma.teamMember.findFirst({
              where: { teamId: tm.teamId, userId: { not: dbUser.id } },
              orderBy: { userId: 'asc' }
            });
            
            if (nextMember) {
              await prisma.teamMember.update({
                where: { teamId_userId: { teamId: nextMember.teamId, userId: nextMember.userId } },
                data: { is_leader: true }
              });
            } else {
              // Si no hay más miembros, borrar revisiones y equipo
              await prisma.finalReview.deleteMany({ where: { team_id: tm.teamId } });
              await prisma.team.delete({ where: { id: tm.teamId } });
            }
          }
        }
        // Quitar al alumno de los equipos y proyectos
        await prisma.teamMember.deleteMany({ where: { userId: dbUser.id } });
        await prisma.projectStudent.deleteMany({ where: { userId: dbUser.id } });
      } else if (roleName === 'PROFESOR' || roleName === 'ADMINISTRADOR') {
        // Lógica de profesor: archivar proyectos si se quedan sin profesores activos
        for (const collab of dbUser.project_collaborations) {
          const otherActiveProfs = await prisma.projectProfessor.count({
            where: { 
              projectId: collab.projectId, 
              userId: { not: dbUser.id },
              user: { is_active: true }
            }
          });
          
          if (otherActiveProfs === 0) {
            await prisma.project.update({
              where: { id: collab.projectId },
              data: { is_archived: true }
            });
          }
        }
      }

      // Anonimización y Soft Delete
      const randomHash = `deleted_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@corvus.local`;
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          is_active: false,
          full_name: 'Usuario Eliminado',
          email: randomHash,
          secondary_email: null,
          google_email: null,
          password_hash: '',
          enrollment_id: null,
          profile_picture: null,
          bio: '',
          tags: [],
          google_access_token: null,
          google_refresh_token: null,
          universityId: null,
          careerId: null
        }
      });

      res.status(200).json({ message: 'Cuenta eliminada exitosamente. Tu historial ha sido anonimizado.' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const logs = await prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to latest 50
      });

      res.status(200).json({ history: logs });
    } catch (error) {
      logger.error('Error fetching user history', { error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

