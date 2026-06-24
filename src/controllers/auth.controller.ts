import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { z } from 'zod';
import logger from '../utils/logger';
import crypto from 'crypto';

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
         res.status(400).json({ error: error.errors });
         return;
      }
      res.status(400).json({ error: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const data = await authService.login(validatedData.email, validatedData.password);
      
      // Disparar evento a Notificaciones si el dispositivo mandó su token FCM
      if (validatedData.fcmToken && data.user) {
        rabbitmqService.publishDeviceRegistered(data.user.id, validatedData.fcmToken);
      }
      
      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: error.errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async googleLogin(req: Request, res: Response) {
    try {
      const validatedData = googleLoginSchema.parse(req.body);
      const data = await authService.googleLogin(validatedData.authCode);

      // Disparar evento a Notificaciones
      if (validatedData.fcmToken && data.user) {
        rabbitmqService.publishDeviceRegistered(data.user.id, validatedData.fcmToken);
      }

      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: error.errors });
         return;
      }
      res.status(401).json({ error: error.message });
    }
  }

  async me(req: Request, res: Response) {
      // req.user is set by authMiddleware
      res.status(200).json({ user: (req as any).user });
  }

  async logout(req: Request, res: Response) {
    try {
      const { fcmToken } = req.body;
      const user = (req as any).user;

      if (user && fcmToken) {
        // Disparar evento a Notificaciones para que borre este token especifico
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
      
      // En producción aquí buscaríamos el usuario en BD y verificaríamos que exista
      // const user = await prisma.user.findUnique({ where: { email: validatedData.email } });
      // if (!user) return res.status(404).json({ error: "User not found" });

      // 1. Generar PIN criptográficamente seguro de 6 dígitos
      const securePin = crypto.randomInt(100000, 999999).toString();

      // 2. Aquí guardaríamos el PIN en la base de datos (con expiración) para validarlo después
      // await prisma.passwordResetToken.create({ ... })

      // 3. Disparar el evento a RabbitMQ para que el servicio de Notificaciones envíe el correo
      // Pasamos un ID dummy "user-id" para la prueba
      rabbitmqService.publishPasswordRecovery("user-id", validatedData.email, securePin);

      res.status(200).json({ 
        message: 'Si el correo existe, se ha enviado un PIN de recuperación.',
        // TODO: Eliminar esta línea en producción. Se expone aquí para facilitar las pruebas E2E.
        _test_pin: securePin 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
         res.status(400).json({ error: error.errors });
         return;
      }
      res.status(500).json({ error: error.message });
    }
  }
}
